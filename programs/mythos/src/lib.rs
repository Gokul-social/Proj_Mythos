use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr");

// ============================================================================
// Constants
// ============================================================================

/// Default minimum collateral ratio: 150% (15000 basis points)
pub const DEFAULT_MIN_COLLATERAL_RATIO_BPS: u16 = 15000;

/// Default liquidation threshold: 120% (12000 basis points)
pub const DEFAULT_LIQUIDATION_THRESHOLD_BPS: u16 = 12000;

/// Basis-point divisor
pub const BPS_DIVISOR: u64 = 10000;

/// Maximum interest rate: 50% (5000 bps)
pub const MAX_INTEREST_RATE_BPS: u16 = 5000;

/// Maximum loan term: 365 days
pub const MAX_TERM_SECONDS: u64 = 365 * 24 * 60 * 60;

// ============================================================================
// Program
// ============================================================================

#[program]
pub mod mythos {
    use super::*;

    /// Initialize the protocol-wide configuration account.
    /// Called once by the deployer / admin.
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        min_collateral_ratio_bps: u16,
        liquidation_threshold_bps: u16,
    ) -> Result<()> {
        require!(
            min_collateral_ratio_bps >= 10000,
            MythosError::InvalidCollateralRatio
        );
        require!(
            liquidation_threshold_bps >= 10000 && liquidation_threshold_bps < min_collateral_ratio_bps,
            MythosError::InvalidLiquidationThreshold
        );

        let protocol = &mut ctx.accounts.protocol_state;
        protocol.admin = ctx.accounts.admin.key();
        protocol.treasury = ctx.accounts.treasury.key();
        protocol.min_collateral_ratio_bps = min_collateral_ratio_bps;
        protocol.liquidation_threshold_bps = liquidation_threshold_bps;
        protocol.loan_count = 0;
        protocol.bump = ctx.bumps.protocol_state;

        msg!("Protocol initialized. Admin: {}", protocol.admin);
        Ok(())
    }

    /// Borrower creates a loan request.
    /// Status → Requested. No funds move yet.
    pub fn initialize_loan(
        ctx: Context<InitializeLoan>,
        loan_id: u64,
        principal: u64,
        interest_rate_bps: u16,
        term_seconds: u64,
    ) -> Result<()> {
        require!(principal > 0, MythosError::InvalidPrincipal);
        require!(
            interest_rate_bps > 0 && interest_rate_bps <= MAX_INTEREST_RATE_BPS,
            MythosError::InvalidInterestRate
        );
        require!(
            term_seconds > 0 && term_seconds <= MAX_TERM_SECONDS,
            MythosError::InvalidTermLength
        );

        let loan = &mut ctx.accounts.loan_account;
        loan.borrower = ctx.accounts.borrower.key();
        loan.lender = Pubkey::default(); // Set when funded
        loan.principal = principal;
        loan.interest_rate_bps = interest_rate_bps;
        loan.term_seconds = term_seconds;
        loan.start_time = 0; // Set when funded
        loan.collateral_mint = ctx.accounts.collateral_mint.key();
        loan.collateral_amount = 0;
        loan.stablecoin_mint = ctx.accounts.stablecoin_mint.key();
        loan.amount_repaid = 0;
        loan.status = LoanStatus::Requested;
        loan.bump = ctx.bumps.loan_account;
        loan.loan_id = loan_id;

        // Increment protocol loan counter
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.loan_count = protocol.loan_count.checked_add(1).unwrap();

        emit!(LoanInitialized {
            loan_id,
            borrower: ctx.accounts.borrower.key(),
            principal,
            interest_rate_bps,
            stablecoin_mint: ctx.accounts.stablecoin_mint.key(),
            collateral_mint: ctx.accounts.collateral_mint.key(),
        });

        msg!(
            "Loan {} initialized. Borrower: {}, Principal: {}",
            loan_id,
            ctx.accounts.borrower.key(),
            principal
        );
        Ok(())
    }

    /// Borrower deposits collateral into the program-owned vault.
    /// Must happen before or after funding — but the collateral ratio
    /// is only enforced when the loan is funded.
    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        require!(amount > 0, MythosError::InvalidAmount);

        let loan = &mut ctx.accounts.loan_account;
        require!(
            loan.status == LoanStatus::Requested || loan.status == LoanStatus::Active,
            MythosError::LoanNotActive
        );
        require!(
            ctx.accounts.borrower.key() == loan.borrower,
            MythosError::Unauthorized
        );

        // Transfer collateral from borrower → vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.borrower_collateral_ata.to_account_info(),
            to: ctx.accounts.collateral_vault.to_account_info(),
            authority: ctx.accounts.borrower.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        loan.collateral_amount = loan
            .collateral_amount
            .checked_add(amount)
            .ok_or(MythosError::Overflow)?;

        emit!(CollateralDeposited {
            loan_id: loan.loan_id,
            amount,
            total_collateral: loan.collateral_amount,
        });

        msg!(
            "Collateral deposited: {}. Total: {}",
            amount,
            loan.collateral_amount
        );
        Ok(())
    }

    /// Lender funds a requested loan.
    /// Transfers stablecoin from lender → borrower.
    /// Status → Active. The clock starts now.
    pub fn fund_loan(ctx: Context<FundLoan>) -> Result<()> {
        let loan = &mut ctx.accounts.loan_account;
        require!(
            loan.status == LoanStatus::Requested,
            MythosError::LoanAlreadyFunded
        );

        // Enforce minimum collateral ratio at funding time.
        // For devnet demo we use a 1:1 price assumption between collateral and stablecoin.
        // In production, integrate Pyth / Switchboard oracle here.
        let required_collateral = loan
            .principal
            .checked_mul(ctx.accounts.protocol_state.min_collateral_ratio_bps as u64)
            .ok_or(MythosError::Overflow)?
            .checked_div(BPS_DIVISOR)
            .ok_or(MythosError::Overflow)?;

        require!(
            loan.collateral_amount >= required_collateral,
            MythosError::InsufficientCollateral
        );

        // Transfer stablecoin from lender → borrower
        let cpi_accounts = Transfer {
            from: ctx.accounts.lender_stablecoin_ata.to_account_info(),
            to: ctx.accounts.borrower_stablecoin_ata.to_account_info(),
            authority: ctx.accounts.lender.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, loan.principal)?;

        let clock = Clock::get()?;
        loan.lender = ctx.accounts.lender.key();
        loan.start_time = clock.unix_timestamp as u64;
        loan.status = LoanStatus::Active;

        emit!(LoanFunded {
            loan_id: loan.loan_id,
            lender: ctx.accounts.lender.key(),
            amount: loan.principal,
        });

        msg!(
            "Loan {} funded by {}. Amount: {}",
            loan.loan_id,
            ctx.accounts.lender.key(),
            loan.principal
        );
        Ok(())
    }

    /// Borrower repays the loan (principal + accrued interest).
    /// Stablecoin flows: borrower → lender.
    /// Collateral flows: vault → borrower (returned).
    /// Status → Repaid.
    pub fn repay_loan(ctx: Context<RepayLoan>) -> Result<()> {
        // Extract all needed values from loan before any CPI calls
        let loan_id;
        let principal;
        let interest;
        let total_repayment;
        let collateral_to_return;
        let bump;
        let borrower_key;
        {
            let loan = &ctx.accounts.loan_account;
            require!(loan.status == LoanStatus::Active, MythosError::LoanNotActive);
            require!(
                ctx.accounts.borrower.key() == loan.borrower,
                MythosError::Unauthorized
            );

            loan_id = loan.loan_id;
            principal = loan.principal;
            bump = loan.bump;
            borrower_key = loan.borrower;
            collateral_to_return = loan.collateral_amount;

            // Calculate total repayment = principal + (principal * rate_bps / 10000)
            interest = loan
                .principal
                .checked_mul(loan.interest_rate_bps as u64)
                .ok_or(MythosError::Overflow)?
                .checked_div(BPS_DIVISOR)
                .ok_or(MythosError::Overflow)?;

            total_repayment = loan
                .principal
                .checked_add(interest)
                .ok_or(MythosError::Overflow)?;
        }

        // Transfer stablecoin from borrower → lender
        let cpi_accounts = Transfer {
            from: ctx.accounts.borrower_stablecoin_ata.to_account_info(),
            to: ctx.accounts.lender_stablecoin_ata.to_account_info(),
            authority: ctx.accounts.borrower.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, total_repayment)?;

        // Return collateral from vault → borrower
        // The vault is a PDA-owned token account; we sign with the loan PDA seeds.
        let loan_id_bytes = loan_id.to_le_bytes();
        let seeds: &[&[u8]] = &[
            b"loan",
            borrower_key.as_ref(),
            &loan_id_bytes,
            &[bump],
        ];
        let signer_seeds = &[seeds];

        let vault_cpi_accounts = Transfer {
            from: ctx.accounts.collateral_vault.to_account_info(),
            to: ctx.accounts.borrower_collateral_ata.to_account_info(),
            authority: ctx.accounts.loan_account.to_account_info(),
        };
        let vault_cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            vault_cpi_accounts,
            signer_seeds,
        );
        token::transfer(vault_cpi_ctx, collateral_to_return)?;

        // Now mutate the loan account
        let loan = &mut ctx.accounts.loan_account;
        loan.amount_repaid = total_repayment;
        loan.collateral_amount = 0;
        loan.status = LoanStatus::Repaid;

        emit!(LoanRepaid {
            loan_id,
            amount_repaid: total_repayment,
            interest_paid: interest,
            collateral_returned: collateral_to_return,
        });

        msg!(
            "Loan {} repaid. Total: {} (principal: {}, interest: {})",
            loan_id,
            total_repayment,
            principal,
            interest
        );
        Ok(())
    }

    /// Liquidate a loan whose collateral ratio has fallen below the threshold.
    /// Typically called by a third-party liquidator.
    /// For devnet: uses 1:1 price assumption. In production, read Pyth oracle.
    /// Collateral flows: vault → liquidator.
    /// Status → Liquidated.
    pub fn liquidate_loan(ctx: Context<LiquidateLoan>) -> Result<()> {
        // Extract values before CPI to avoid borrow conflicts
        let loan_id;
        let bump;
        let borrower_key;
        let collateral_seized;
        {
            let loan = &ctx.accounts.loan_account;
            require!(loan.status == LoanStatus::Active, MythosError::LoanNotActive);

            // Check that collateral ratio is below liquidation threshold.
            // outstanding = principal + interest - amount_repaid
            let interest = loan
                .principal
                .checked_mul(loan.interest_rate_bps as u64)
                .ok_or(MythosError::Overflow)?
                .checked_div(BPS_DIVISOR)
                .ok_or(MythosError::Overflow)?;

            let outstanding = loan
                .principal
                .checked_add(interest)
                .ok_or(MythosError::Overflow)?
                .checked_sub(loan.amount_repaid)
                .ok_or(MythosError::Overflow)?;

            // current_ratio_bps = (collateral_amount * 10000) / outstanding
            // For devnet we assume 1:1 price ratio between collateral and stablecoin.
            let current_ratio_bps = if outstanding > 0 {
                loan.collateral_amount
                    .checked_mul(BPS_DIVISOR)
                    .ok_or(MythosError::Overflow)?
                    .checked_div(outstanding)
                    .ok_or(MythosError::Overflow)?
            } else {
                u64::MAX // fully repaid, cannot liquidate
            };

            require!(
                current_ratio_bps < ctx.accounts.protocol_state.liquidation_threshold_bps as u64,
                MythosError::CollateralSufficient
            );

            loan_id = loan.loan_id;
            bump = loan.bump;
            borrower_key = loan.borrower;
            collateral_seized = loan.collateral_amount;
        }

        // Transfer collateral from vault → liquidator
        let loan_id_bytes = loan_id.to_le_bytes();
        let seeds: &[&[u8]] = &[
            b"loan",
            borrower_key.as_ref(),
            &loan_id_bytes,
            &[bump],
        ];
        let signer_seeds = &[seeds];

        let vault_cpi_accounts = Transfer {
            from: ctx.accounts.collateral_vault.to_account_info(),
            to: ctx.accounts.liquidator_collateral_ata.to_account_info(),
            authority: ctx.accounts.loan_account.to_account_info(),
        };
        let vault_cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            vault_cpi_accounts,
            signer_seeds,
        );
        token::transfer(vault_cpi_ctx, collateral_seized)?;

        // Now mutate the loan account
        let loan = &mut ctx.accounts.loan_account;
        loan.collateral_amount = 0;
        loan.status = LoanStatus::Liquidated;

        emit!(LoanLiquidated {
            loan_id,
            liquidator: ctx.accounts.liquidator.key(),
            collateral_seized,
        });

        msg!(
            "Loan {} liquidated by {}. Collateral seized: {}",
            loan_id,
            ctx.accounts.liquidator.key(),
            collateral_seized
        );
        Ok(())
    }
}

// ============================================================================
// Account Structs
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    /// Admin public key (can update config)
    pub admin: Pubkey,
    /// Treasury wallet for protocol fees
    pub treasury: Pubkey,
    /// Minimum collateral ratio in basis points (e.g. 15000 = 150%)
    pub min_collateral_ratio_bps: u16,
    /// Liquidation threshold in basis points (e.g. 12000 = 120%)
    pub liquidation_threshold_bps: u16,
    /// Total loans created
    pub loan_count: u64,
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LoanAccount {
    /// Borrower public key
    pub borrower: Pubkey,
    /// Lender public key (default until funded)
    pub lender: Pubkey,
    /// Loan principal in stablecoin smallest unit (e.g. USDC has 6 decimals)
    pub principal: u64,
    /// Interest rate in basis points (e.g. 750 = 7.5%)
    pub interest_rate_bps: u16,
    /// Loan duration in seconds
    pub term_seconds: u64,
    /// Unix timestamp when loan was funded (0 = not yet funded)
    pub start_time: u64,
    /// Collateral token mint
    pub collateral_mint: Pubkey,
    /// Current collateral amount held in vault
    pub collateral_amount: u64,
    /// Stablecoin mint (USDC)
    pub stablecoin_mint: Pubkey,
    /// Amount already repaid
    pub amount_repaid: u64,
    /// Loan status
    pub status: LoanStatus,
    /// PDA bump seed
    pub bump: u8,
    /// Unique loan identifier (counter-based)
    pub loan_id: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum LoanStatus {
    Requested,
    Active,
    Repaid,
    Liquidated,
}

// ============================================================================
// Instruction Accounts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [b"protocol"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    /// Treasury wallet (any pubkey, doesn't need to sign)
    /// CHECK: This is just stored as a pubkey for future fee routing.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(loan_id: u64)]
pub struct InitializeLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(
        init,
        payer = borrower,
        space = 8 + LoanAccount::INIT_SPACE,
        seeds = [b"loan", borrower.key().as_ref(), &loan_id.to_le_bytes()],
        bump
    )]
    pub loan_account: Account<'info, LoanAccount>,

    /// The vault token account owned by the loan PDA.
    /// Holds collateral for this specific loan.
    #[account(
        init,
        payer = borrower,
        token::mint = collateral_mint,
        token::authority = loan_account,
        seeds = [b"vault", loan_account.key().as_ref()],
        bump
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    /// Collateral token mint (e.g. wSOL)
    pub collateral_mint: Account<'info, Mint>,

    /// Stablecoin mint (e.g. USDC devnet)
    pub stablecoin_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(
        mut,
        seeds = [b"loan", loan_account.borrower.as_ref(), &loan_account.loan_id.to_le_bytes()],
        bump = loan_account.bump,
        constraint = loan_account.borrower == borrower.key() @ MythosError::Unauthorized
    )]
    pub loan_account: Account<'info, LoanAccount>,

    /// Borrower's collateral token account
    #[account(
        mut,
        constraint = borrower_collateral_ata.mint == loan_account.collateral_mint @ MythosError::MintMismatch,
        constraint = borrower_collateral_ata.owner == borrower.key() @ MythosError::Unauthorized
    )]
    pub borrower_collateral_ata: Account<'info, TokenAccount>,

    /// Vault token account (PDA-owned)
    #[account(
        mut,
        seeds = [b"vault", loan_account.key().as_ref()],
        bump,
        constraint = collateral_vault.mint == loan_account.collateral_mint @ MythosError::MintMismatch
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FundLoan<'info> {
    #[account(mut)]
    pub lender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"loan", loan_account.borrower.as_ref(), &loan_account.loan_id.to_le_bytes()],
        bump = loan_account.bump
    )]
    pub loan_account: Account<'info, LoanAccount>,

    #[account(
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    /// Lender's stablecoin token account (source of funds)
    #[account(
        mut,
        constraint = lender_stablecoin_ata.mint == loan_account.stablecoin_mint @ MythosError::MintMismatch,
        constraint = lender_stablecoin_ata.owner == lender.key() @ MythosError::Unauthorized
    )]
    pub lender_stablecoin_ata: Account<'info, TokenAccount>,

    /// Borrower's stablecoin token account (destination of funds)
    #[account(
        mut,
        constraint = borrower_stablecoin_ata.mint == loan_account.stablecoin_mint @ MythosError::MintMismatch,
        constraint = borrower_stablecoin_ata.owner == loan_account.borrower @ MythosError::Unauthorized
    )]
    pub borrower_stablecoin_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RepayLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(
        mut,
        seeds = [b"loan", loan_account.borrower.as_ref(), &loan_account.loan_id.to_le_bytes()],
        bump = loan_account.bump,
        constraint = loan_account.borrower == borrower.key() @ MythosError::Unauthorized
    )]
    pub loan_account: Account<'info, LoanAccount>,

    /// Borrower's stablecoin ATA (pays principal + interest)
    #[account(
        mut,
        constraint = borrower_stablecoin_ata.mint == loan_account.stablecoin_mint @ MythosError::MintMismatch,
        constraint = borrower_stablecoin_ata.owner == borrower.key() @ MythosError::Unauthorized
    )]
    pub borrower_stablecoin_ata: Account<'info, TokenAccount>,

    /// Lender's stablecoin ATA (receives repayment)
    #[account(
        mut,
        constraint = lender_stablecoin_ata.mint == loan_account.stablecoin_mint @ MythosError::MintMismatch,
        constraint = lender_stablecoin_ata.owner == loan_account.lender @ MythosError::Unauthorized
    )]
    pub lender_stablecoin_ata: Account<'info, TokenAccount>,

    /// Collateral vault (returns collateral to borrower)
    #[account(
        mut,
        seeds = [b"vault", loan_account.key().as_ref()],
        bump,
        constraint = collateral_vault.mint == loan_account.collateral_mint @ MythosError::MintMismatch
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    /// Borrower's collateral ATA (receives returned collateral)
    #[account(
        mut,
        constraint = borrower_collateral_ata.mint == loan_account.collateral_mint @ MythosError::MintMismatch,
        constraint = borrower_collateral_ata.owner == borrower.key() @ MythosError::Unauthorized
    )]
    pub borrower_collateral_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LiquidateLoan<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"loan", loan_account.borrower.as_ref(), &loan_account.loan_id.to_le_bytes()],
        bump = loan_account.bump
    )]
    pub loan_account: Account<'info, LoanAccount>,

    #[account(
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    /// Collateral vault (collateral seized by liquidator)
    #[account(
        mut,
        seeds = [b"vault", loan_account.key().as_ref()],
        bump,
        constraint = collateral_vault.mint == loan_account.collateral_mint @ MythosError::MintMismatch
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    /// Liquidator's collateral ATA (receives seized collateral)
    #[account(
        mut,
        constraint = liquidator_collateral_ata.mint == loan_account.collateral_mint @ MythosError::MintMismatch,
        constraint = liquidator_collateral_ata.owner == liquidator.key() @ MythosError::Unauthorized
    )]
    pub liquidator_collateral_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct LoanInitialized {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub principal: u64,
    pub interest_rate_bps: u16,
    pub stablecoin_mint: Pubkey,
    pub collateral_mint: Pubkey,
}

#[event]
pub struct LoanFunded {
    pub loan_id: u64,
    pub lender: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CollateralDeposited {
    pub loan_id: u64,
    pub amount: u64,
    pub total_collateral: u64,
}

#[event]
pub struct LoanRepaid {
    pub loan_id: u64,
    pub amount_repaid: u64,
    pub interest_paid: u64,
    pub collateral_returned: u64,
}

#[event]
pub struct LoanLiquidated {
    pub loan_id: u64,
    pub liquidator: Pubkey,
    pub collateral_seized: u64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum MythosError {
    #[msg("Loan principal must be greater than zero")]
    InvalidPrincipal,

    #[msg("Interest rate must be between 1 and 5000 basis points")]
    InvalidInterestRate,

    #[msg("Loan term must be between 1 second and 365 days")]
    InvalidTermLength,

    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Loan is not in Active status")]
    LoanNotActive,

    #[msg("Loan has already been funded")]
    LoanAlreadyFunded,

    #[msg("Insufficient collateral to meet minimum ratio")]
    InsufficientCollateral,

    #[msg("Collateral ratio is above liquidation threshold; cannot liquidate")]
    CollateralSufficient,

    #[msg("Unauthorized: signer does not match expected account")]
    Unauthorized,

    #[msg("Token mint does not match expected mint")]
    MintMismatch,

    #[msg("Collateral ratio must be at least 100% (10000 bps)")]
    InvalidCollateralRatio,

    #[msg("Liquidation threshold must be >= 100% and < collateral ratio")]
    InvalidLiquidationThreshold,

    #[msg("Arithmetic overflow")]
    Overflow,
}
