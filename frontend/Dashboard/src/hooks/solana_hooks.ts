/**
 * Mythos — Solana Program Integration Hooks
 * ==========================================
 * TypeScript hooks for frontend → backend Solana calls.
 *
 * Usage:
 *   import { useInitializeLoan, useRepayLoan, useFetchLoan } from './hooks/solana_hooks';
 *
 * These hooks call the backend API which handles transaction building and signing.
 * For direct-to-program calls (wallet-signed), see the `useSolanaDirectClient` export.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================================================
// Types
// ============================================================================

export interface LoanParams {
  loanId: number;
  principal: number;
  interestRateBps: number;
  termSeconds: number;
  collateralMintAddress: string;
  stablecoinMintAddress: string;
}

export interface RepayParams {
  loanId: number;
  stablecoinMintAddress: string;
  collateralMintAddress: string;
  lenderAddress: string;
}

export interface FundParams {
  borrowerAddress: string;
  loanId: number;
  stablecoinMintAddress: string;
}

export interface DepositCollateralParams {
  loanId: number;
  amount: number;
  collateralMintAddress: string;
}

export interface LiquidateParams {
  borrowerAddress: string;
  loanId: number;
  collateralMintAddress: string;
}

export interface LoanData {
  borrower: string;
  lender: string;
  principal: number;
  interest_rate_bps: number;
  term_seconds: number;
  start_time: number;
  collateral_mint: string;
  collateral_amount: number;
  stablecoin_mint: string;
  amount_repaid: number;
  status: 'Requested' | 'Active' | 'Repaid' | 'Liquidated';
  loan_id: number;
  loan_pda: string;
}

export interface TxResult {
  success: boolean;
  tx_signature?: string;
  error?: string;
  loan_pda?: string;
}

// ============================================================================
// API Helpers
// ============================================================================

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================================
// Hook: Initialize Loan
// ============================================================================

/**
 * Initialize a new loan on-chain via the backend API.
 *
 * Example:
 *   const result = await initializeLoan({
 *     loanId: 1,
 *     principal: 1_000_000,  // 1 USDC
 *     interestRateBps: 750,  // 7.5%
 *     termSeconds: 2592000,  // 30 days
 *     collateralMintAddress: "So11111111111111111111111111111111111111112", // wSOL
 *     stablecoinMintAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC
 *   });
 */
export async function initializeLoan(params: LoanParams): Promise<TxResult> {
  return postJson<TxResult>('/api/solana/initialize-loan', {
    loan_id: params.loanId,
    principal: params.principal,
    interest_rate_bps: params.interestRateBps,
    term_seconds: params.termSeconds,
    collateral_mint: params.collateralMintAddress,
    stablecoin_mint: params.stablecoinMintAddress,
  });
}

// ============================================================================
// Hook: Deposit Collateral
// ============================================================================

export async function depositCollateral(params: DepositCollateralParams): Promise<TxResult> {
  return postJson<TxResult>('/api/solana/deposit-collateral', {
    loan_id: params.loanId,
    amount: params.amount,
    collateral_mint: params.collateralMintAddress,
  });
}

// ============================================================================
// Hook: Fund Loan
// ============================================================================

export async function fundLoan(params: FundParams): Promise<TxResult> {
  return postJson<TxResult>('/api/solana/fund-loan', {
    borrower_address: params.borrowerAddress,
    loan_id: params.loanId,
    stablecoin_mint: params.stablecoinMintAddress,
  });
}

// ============================================================================
// Hook: Repay Loan
// ============================================================================

/**
 * Repay a loan on-chain via the backend API.
 *
 * Example:
 *   const result = await repayLoan({
 *     loanId: 1,
 *     stablecoinMintAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
 *     collateralMintAddress: "So11111111111111111111111111111111111111112",
 *     lenderAddress: "LenderPubkeyHere...",
 *   });
 */
export async function repayLoan(params: RepayParams): Promise<TxResult> {
  return postJson<TxResult>('/api/solana/repay-loan', {
    loan_id: params.loanId,
    stablecoin_mint: params.stablecoinMintAddress,
    collateral_mint: params.collateralMintAddress,
    lender_address: params.lenderAddress,
  });
}

// ============================================================================
// Hook: Liquidate Loan
// ============================================================================

export async function liquidateLoan(params: LiquidateParams): Promise<TxResult> {
  return postJson<TxResult>('/api/solana/liquidate-loan', {
    borrower_address: params.borrowerAddress,
    loan_id: params.loanId,
    collateral_mint: params.collateralMintAddress,
  });
}

// ============================================================================
// Hook: Fetch Loan
// ============================================================================

/**
 * Fetch loan state from on-chain.
 *
 * Example:
 *   const loan = await fetchLoan("BorrowerPubkey", 1);
 *   console.log(loan.status); // "Active"
 */
export async function fetchLoan(borrowerAddress: string, loanId: number): Promise<LoanData | null> {
  try {
    return await getJson<LoanData>(`/api/solana/loan/${borrowerAddress}/${loanId}`);
  } catch {
    return null;
  }
}

// ============================================================================
// Hook: Fetch Protocol State
// ============================================================================

export async function fetchProtocol(): Promise<Record<string, unknown> | null> {
  try {
    return await getJson<Record<string, unknown>>('/api/solana/protocol');
  } catch {
    return null;
  }
}

// ============================================================================
// Transaction Flow Example (for documentation)
// ============================================================================

/**
 * Full transaction flow example:
 *
 * 1. Frontend calls `initializeLoan()` → backend builds tx, signs with server keypair, sends to Solana
 * 2. Frontend calls `depositCollateral()` → backend transfers collateral to vault
 * 3. Lender calls `fundLoan()` → backend transfers USDC from lender to borrower
 * 4. Borrower calls `repayLoan()` → backend transfers USDC back + returns collateral
 *
 * Alternative: Direct-to-program (wallet-signed):
 *   Uses @coral-xyz/anchor in the browser with Phantom/Solflare wallet adapter.
 *   The IDL is fetched from `target/idl/mythos.json` and the program is accessed directly.
 *
 * Example with wallet adapter:
 *
 *   import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
 *   import { useWallet, useConnection } from "@solana/wallet-adapter-react";
 *
 *   const { connection } = useConnection();
 *   const wallet = useWallet();
 *   const provider = new AnchorProvider(connection, wallet, {});
 *   const idl = await Program.fetchIdl(PROGRAM_ID, provider);
 *   const program = new Program(idl, PROGRAM_ID, provider);
 *
 *   // Now call program.methods.initializeLoan(...) directly
 */
