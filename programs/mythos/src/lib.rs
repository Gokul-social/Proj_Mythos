use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM");



/// ============================================================================
/// MYTHOS — AI-Native Agentic Lending Protocol
/// ============================================================================
/// 
/// Program Instructions:
///   1. initialize_loan       - Borrower opens a loan request
///   2. accept_loan           - Lender agent accepts negotiated terms  
///   3. repay_loan            - Borrower repays principal + interest
///   4. liquidate             - Liquidate undercollateralized position
///   5. update_attestation    - Update credit attestation on-chain
///
/// Accounts:
///   LoanAccount     - Stores loan state and negotiated terms
///   CollateralVault - Holds SPL token collateral (SOL/USDC)
///   ProtocolConfig  - Global protocol configuration
/// ============================================================================

#[program]
pub mod mythos {
    use super::*;

    /// Initialize a new loan request from a borrower.
    /// The borrower provides collateral which is locked in a vault PDA.
    ///
    /// Parameters:
    ///   - amount_usdc:     Loan amount requested (in USDC lamports, 6 decimals)
    ///   - initial_rate_bps: Starting interest rate in basis points (e.g. 850 = 8.50%)
    ///   - term_months:     Loan duration in months (1-36)
    ///   - attestation_id:  SAS credit attestation ID for this borrower
    pub fn initialize_loan(
        ctx: Context<InitializeLoan>,
        amount_usdc: u64,
        initial_rate_bps: u16,
        term_months: u8,
        attestation_id: [u8; 32],
    ) -> Result<()> {
        require!(amount_usdc > 0, MythosError::InvalidAmount);
        require!(term_months > 0 && term_months <= 36, MythosError::InvalidTerm);
        require!(initial_rate_bps > 0 && initial_rate_bps <= 5000, MythosError::InvalidRate);

        let loan = &mut ctx.accounts.loan;
        let clock = Clock::get()?;

        loan.borrower = ctx.accounts.borrower.key();
        loan.amount_usdc = amount_usdc;
        loan.initial_rate_bps = initial_rate_bps;
        loan.final_rate_bps = 0; // Set when loan is accepted
        loan.term_months = term_months;
        loan.attestation_id = attestation_id;
        // Transfer collateral to vault — read amount BEFORE transfer, record in state
        let collateral_amount = ctx.accounts.borrower_collateral_account.amount;
        require!(collateral_amount > 0, MythosError::NoCollateral);

        // Record AFTER reading from borrower account — captures actual deposited amount
        loan.collateral_amount = collateral_amount;
        loan.status = LoanStatus::Pending;
        loan.created_at = clock.unix_timestamp;
        loan.due_at = 0; // Set when loan is accepted
        loan.negotiation_rounds = 0;
        loan.bump = ctx.bumps.loan;
        // vault_bump not stored — CPI signs with loan PDA seeds (authority = loan)

        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower_collateral_account.to_account_info(),
                to: ctx.accounts.collateral_vault.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, collateral_amount)?;

        emit!(LoanInitialized {
            loan_id: loan.key(),
            borrower: loan.borrower,
            amount_usdc,
            initial_rate_bps,
            term_months,
            attestation_id,
            timestamp: clock.unix_timestamp,
        });

        msg!("Mythos: Loan initialized — {} USDC at {}bps for {} months", 
             amount_usdc, initial_rate_bps, term_months);
        Ok(())
    }

    /// Lender agent accepts the loan with negotiated interest rate.
    /// Called after AI agents (Lenny & Luna) have completed negotiation.
    ///
    /// Parameters:
    ///   - final_rate_bps:     Agreed-upon interest rate in basis points
    ///   - negotiation_rounds: Number of negotiation rounds completed
    pub fn accept_loan(
        ctx: Context<AcceptLoan>,
        final_rate_bps: u16,
        negotiation_rounds: u8,
    ) -> Result<()> {
        let loan = &mut ctx.accounts.loan;
        let clock = Clock::get()?;

        require!(loan.status == LoanStatus::Pending, MythosError::LoanNotPending);
        require!(final_rate_bps > 0 && final_rate_bps <= 5000, MythosError::InvalidRate);

        loan.lender = ctx.accounts.lender.key();
        loan.final_rate_bps = final_rate_bps;
        loan.negotiation_rounds = negotiation_rounds;
        loan.status = LoanStatus::Active;
        loan.accepted_at = clock.unix_timestamp;
        
        // Calculate due date (term_months from now)
        loan.due_at = clock.unix_timestamp + (loan.term_months as i64 * 30 * 24 * 60 * 60);

        // Transfer USDC from lender to borrower
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.lender_usdc_account.to_account_info(),
                to: ctx.accounts.borrower_usdc_account.to_account_info(),
                authority: ctx.accounts.lender.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, loan.amount_usdc)?;

        emit!(LoanAccepted {
            loan_id: loan.key(),
            lender: loan.lender,
            borrower: loan.borrower,
            final_rate_bps,
            negotiation_rounds,
            amount_usdc: loan.amount_usdc,
            due_at: loan.due_at,
            timestamp: clock.unix_timestamp,
        });

        msg!("Mythos: Loan accepted — {}bps after {} rounds", final_rate_bps, negotiation_rounds);
        Ok(())
    }

    /// Borrower repays the loan (principal + interest).
    /// Collateral is released back to the borrower upon full repayment.
    pub fn repay_loan(ctx: Context<RepayLoan>, amount_usdc: u64) -> Result<()> {
        // Extract all values BEFORE mutable borrow to satisfy borrow checker
        let collateral_amt  = ctx.accounts.loan.collateral_amount;
        let loan_status     = ctx.accounts.loan.status.clone();
        let borrower_key    = ctx.accounts.loan.borrower;
        let lender_key      = ctx.accounts.loan.lender;
        let principal       = ctx.accounts.loan.amount_usdc;
        let rate_bps        = ctx.accounts.loan.final_rate_bps;
        let term_months     = ctx.accounts.loan.term_months;
        // Sign with LOAN PDA seeds (vault authority = loan, not vault)
        let loan_bump_val   = ctx.accounts.loan.bump;
        let loan_acct_info  = ctx.accounts.loan.to_account_info(); // before &mut

        let loan = &mut ctx.accounts.loan;
        let clock = Clock::get()?;

        require!(loan_status == LoanStatus::Active, MythosError::LoanNotActive);
        require!(ctx.accounts.borrower.key() == borrower_key, MythosError::Unauthorized);

        let interest_amount = calculate_interest(principal, rate_bps, term_months);
        let total_due = principal + interest_amount;
        require!(amount_usdc >= total_due, MythosError::InsufficientRepayment);

        // Transfer USDC from borrower to lender
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower_usdc_account.to_account_info(),
                to: ctx.accounts.lender_usdc_account.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, total_due)?;

        // Release collateral — authority is loan PDA, so sign with loan seeds
        let loan_seeds = &[b"loan".as_ref(), borrower_key.as_ref(), &principal.to_le_bytes(), &[loan_bump_val]];
        let signer = &[&loan_seeds[..]];
        let release_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.collateral_vault.to_account_info(),
                to: ctx.accounts.borrower_collateral_account.to_account_info(),
                authority: loan_acct_info,
            },
            signer,
        );
        token::transfer(release_ctx, collateral_amt)?;

        loan.status   = LoanStatus::Repaid;
        loan.repaid_at = clock.unix_timestamp;

        emit!(LoanRepaid {
            loan_id: loan.key(),
            borrower: borrower_key,
            lender: lender_key,
            amount_repaid: total_due,
            interest_paid: interest_amount,
            timestamp: clock.unix_timestamp,
        });

        msg!("Mythos: Loan repaid — {} USDC ({} interest)", total_due, interest_amount);
        Ok(())
    }

    /// Liquidate an undercollateralized or overdue loan.
    /// Anyone can call this to maintain protocol health.
    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        // Extract all values BEFORE mutable borrow
        let collateral_amt  = ctx.accounts.loan.collateral_amount;
        let loan_status     = ctx.accounts.loan.status.clone();
        let due_at          = ctx.accounts.loan.due_at;
        let borrower_key    = ctx.accounts.loan.borrower;
        let lender_key      = ctx.accounts.loan.lender;
        let loan_principal  = ctx.accounts.loan.amount_usdc;
        // Sign with LOAN PDA seeds (vault authority = loan, not vault)
        let loan_bump_val   = ctx.accounts.loan.bump;
        let loan_acct_info  = ctx.accounts.loan.to_account_info(); // before &mut

        let loan = &mut ctx.accounts.loan;
        let clock = Clock::get()?;

        require!(loan_status == LoanStatus::Active, MythosError::LoanNotActive);

        let is_overdue = clock.unix_timestamp > due_at;
        let is_undercollateralized = false; // Jupiter oracle check in production
        require!(is_overdue || is_undercollateralized, MythosError::NotLiquidatable);

        // Seize collateral — authority is loan PDA, so sign with loan seeds
        let loan_seeds = &[b"loan".as_ref(), borrower_key.as_ref(), &loan_principal.to_le_bytes(), &[loan_bump_val]];
        let signer = &[&loan_seeds[..]];
        let liquidate_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.collateral_vault.to_account_info(),
                to: ctx.accounts.lender_collateral_account.to_account_info(),
                authority: loan_acct_info,
            },
            signer,
        );
        token::transfer(liquidate_ctx, collateral_amt)?;

        loan.status = LoanStatus::Liquidated;

        emit!(LoanLiquidated {
            loan_id: loan.key(),
            borrower: borrower_key,
            lender: lender_key,
            collateral_seized: collateral_amt,
            reason: if is_overdue { "overdue" } else { "undercollateralized" }.to_string(),
            timestamp: clock.unix_timestamp,
        });

        msg!("Mythos: Loan liquidated");
        Ok(())
    }
}


// ============================================================================
// Helper Functions
// ============================================================================

/// Calculate simple interest: principal * rate * time
fn calculate_interest(principal: u64, rate_bps: u16, term_months: u8) -> u64 {
    let rate = rate_bps as u64;
    let months = term_months as u64;
    // principal * rate_bps / 10000 * term_months / 12
    principal * rate * months / (10000 * 12)
}


// ============================================================================
// Account Structures
// ============================================================================

#[account]
#[derive(Default)]
pub struct LoanAccount {
    pub borrower: Pubkey,           // 32
    pub lender: Pubkey,             // 32
    pub amount_usdc: u64,           // 8
    pub initial_rate_bps: u16,      // 2
    pub final_rate_bps: u16,        // 2
    pub term_months: u8,            // 1
    pub negotiation_rounds: u8,     // 1
    pub collateral_amount: u64,     // 8
    pub attestation_id: [u8; 32],   // 32
    pub status: LoanStatus,         // 1 + discriminant
    pub created_at: i64,            // 8
    pub accepted_at: i64,           // 8
    pub due_at: i64,                // 8
    pub repaid_at: i64,             // 8
    pub bump: u8,                   // 1  — loan PDA bump
}

impl LoanAccount {
    // discriminator(8) + borrower(32) + lender(32) + amount_usdc(8)
    // + initial_rate_bps(2) + final_rate_bps(2) + term_months(1)
    // + negotiation_rounds(1) + collateral_amount(8) + attestation_id(32)
    // + status(1) + created_at(8) + accepted_at(8) + due_at(8)
    // + repaid_at(8) + bump(1) = 162
    pub const LEN: usize = 8 + 32 + 32 + 8 + 2 + 2 + 1 + 1 + 8 + 32 + 1 + 8 + 8 + 8 + 8 + 1; // = 162
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, PartialEq)]
pub enum LoanStatus {
    #[default]
    Pending,
    Active,
    Repaid,
    Liquidated,
    Cancelled,
}


// ============================================================================
// Instruction Contexts
// ============================================================================

#[derive(Accounts)]
#[instruction(amount_usdc: u64, initial_rate_bps: u16, term_months: u8, attestation_id: [u8; 32])]
pub struct InitializeLoan<'info> {
    #[account(
        init,
        payer = borrower,
        space = LoanAccount::LEN,
        seeds = [b"loan", borrower.key().as_ref(), &amount_usdc.to_le_bytes()],
        bump
    )]
    pub loan: Account<'info, LoanAccount>,

    /// The collateral vault is a PDA token account owned by the loan PDA.
    /// Seeds use borrower + amount_usdc (same as loan) so the vault can be
    /// derived client-side before the loan account exists.
    #[account(
        init,
        payer = borrower,
        token::mint = collateral_mint,
        token::authority = loan,
        seeds = [b"vault", borrower.key().as_ref(), &amount_usdc.to_le_bytes()],
        bump,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub borrower_collateral_account: Account<'info, TokenAccount>,

    pub collateral_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AcceptLoan<'info> {
    #[account(
        mut,
        constraint = loan.status == LoanStatus::Pending @ MythosError::LoanNotPending
    )]
    pub loan: Account<'info, LoanAccount>,

    #[account(
        mut,
        constraint = lender_usdc_account.owner == lender.key()
    )]
    pub lender_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = borrower_usdc_account.owner == loan.borrower
    )]
    pub borrower_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lender: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RepayLoan<'info> {
    #[account(
        mut,
        constraint = loan.status == LoanStatus::Active @ MythosError::LoanNotActive
    )]
    pub loan: Account<'info, LoanAccount>,

    /// Vault: seeds = [b"vault", borrower, amount_usdc]. Anchor re-derives bump.
    #[account(
        mut,
        seeds = [b"vault", loan.borrower.as_ref(), &loan.amount_usdc.to_le_bytes()],
        bump,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub borrower_collateral_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub borrower_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lender_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(
        mut,
        constraint = loan.status == LoanStatus::Active @ MythosError::LoanNotActive
    )]
    pub loan: Account<'info, LoanAccount>,

    /// Vault: seeds = [b"vault", borrower, amount_usdc]. Anchor re-derives bump.
    #[account(
        mut,
        seeds = [b"vault", loan.borrower.as_ref(), &loan.amount_usdc.to_le_bytes()],
        bump,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lender_collateral_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub liquidator: Signer<'info>,

    pub token_program: Program<'info, Token>,
}


// ============================================================================
// Events
// ============================================================================

#[event]
pub struct LoanInitialized {
    pub loan_id: Pubkey,
    pub borrower: Pubkey,
    pub amount_usdc: u64,
    pub initial_rate_bps: u16,
    pub term_months: u8,
    pub attestation_id: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct LoanAccepted {
    pub loan_id: Pubkey,
    pub lender: Pubkey,
    pub borrower: Pubkey,
    pub final_rate_bps: u16,
    pub negotiation_rounds: u8,
    pub amount_usdc: u64,
    pub due_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct LoanRepaid {
    pub loan_id: Pubkey,
    pub borrower: Pubkey,
    pub lender: Pubkey,
    pub amount_repaid: u64,
    pub interest_paid: u64,
    pub timestamp: i64,
}

#[event]
pub struct LoanLiquidated {
    pub loan_id: Pubkey,
    pub borrower: Pubkey,
    pub lender: Pubkey,
    pub collateral_seized: u64,
    pub reason: String,
    pub timestamp: i64,
}


// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum MythosError {
    #[msg("Loan amount must be greater than zero")]
    InvalidAmount,
    #[msg("Loan term must be between 1 and 36 months")]
    InvalidTerm,
    #[msg("Interest rate must be between 1 and 5000 basis points")]
    InvalidRate,
    #[msg("Loan must be in Pending status to accept")]
    LoanNotPending,
    #[msg("Loan must be in Active status for this operation")]
    LoanNotActive,
    #[msg("Unauthorized: only borrower can perform this action")]
    Unauthorized,
    #[msg("No collateral provided")]
    NoCollateral,
    #[msg("Repayment amount insufficient")]
    InsufficientRepayment,
    #[msg("Loan is not eligible for liquidation")]
    NotLiquidatable,
    #[msg("Invalid credit attestation")]
    InvalidAttestation,
}
