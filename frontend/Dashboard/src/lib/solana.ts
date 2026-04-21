/**
 * Mythos — Solana Connection & Utility Library
 * ============================================
 * Core Solana utilities for wallet connection, transaction building,
 * and real-time on-chain data access via Helius RPC.
 *
 * Note: @solana/web3.js is an optional peer dependency.
 * The frontend works in demo mode without it.
 */

// ============================================================================
// Configuration
// ============================================================================

export const SOLANA_NETWORK = (import.meta.env.VITE_SOLANA_NETWORK || 'devnet') as string;
export const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY || 'demo';
export const MYTHOS_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID
  || import.meta.env.VITE_MYTHOS_PROGRAM_ID
  || '9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr';
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ============================================================================
// Balance & Account Utilities (fetch-based, no @solana/web3.js required)
// ============================================================================

function getHeliusRpcUrl(): string {
  return HELIUS_API_KEY !== 'demo'
    ? `https://${SOLANA_NETWORK}.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : `https://api.devnet.solana.com`;
}

export async function getSolBalance(publicKey: { toString: () => string }): Promise<number> {
  try {
    const rpcUrl = getHeliusRpcUrl();
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getBalance',
        params: [publicKey.toString()]
      })
    });
    const data = await resp.json();
    return (data?.result?.value || 0) / 1e9;
  } catch {
    return 0;
  }
}

export async function getSlot(): Promise<number> {
  try {
    const rpcUrl = getHeliusRpcUrl();
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot' })
    });
    const data = await resp.json();
    return data?.result || 350_000_000;
  } catch {
    return 350_000_000;
  }
}

// ============================================================================
// Jupiter Price API
// ============================================================================

export interface TokenPrice {
  symbol: string;
  mint: string;
  priceUsd: number;
  change24h?: number;
}

const JUPITER_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

export async function getJupiterPrice(symbol: string): Promise<TokenPrice | null> {
  const mint = JUPITER_MINTS[symbol.toUpperCase()];
  if (!mint) return null;

  try {
    const resp = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
    const data = await resp.json();
    const price = data?.data?.[mint]?.price;
    
    return {
      symbol: symbol.toUpperCase(),
      mint,
      priceUsd: price || getMockPrice(symbol),
      change24h: data?.data?.[mint]?.change24h,
    };
  } catch {
    return {
      symbol: symbol.toUpperCase(),
      mint,
      priceUsd: getMockPrice(symbol),
    };
  }
}

export async function getMultiplePrices(symbols: string[]): Promise<Record<string, TokenPrice>> {
  const mints = symbols
    .map(s => JUPITER_MINTS[s.toUpperCase()])
    .filter(Boolean);

  if (mints.length === 0) {
    return Object.fromEntries(
      symbols.map(s => [s, { symbol: s, mint: '', priceUsd: getMockPrice(s) }])
    );
  }

  try {
    const resp = await fetch(`https://price.jup.ag/v6/price?ids=${mints.join(',')}`);
    const data = await resp.json();
    
    const result: Record<string, TokenPrice> = {};
    for (const symbol of symbols) {
      const mint = JUPITER_MINTS[symbol.toUpperCase()];
      if (mint && data?.data?.[mint]) {
        result[symbol] = {
          symbol: symbol.toUpperCase(),
          mint,
          priceUsd: data.data[mint].price,
          change24h: data.data[mint].change24h,
        };
      } else {
        result[symbol] = { symbol, mint: mint || '', priceUsd: getMockPrice(symbol) };
      }
    }
    return result;
  } catch {
    return Object.fromEntries(
      symbols.map(s => [s, { symbol: s, mint: JUPITER_MINTS[s] || '', priceUsd: getMockPrice(s) }])
    );
  }
}

function getMockPrice(symbol: string): number {
  const mockPrices: Record<string, number> = {
    SOL: 180.50,
    USDC: 1.00,
    BONK: 0.000025,
    JUP: 0.85,
  };
  return mockPrices[symbol.toUpperCase()] || 1.0;
}

// ============================================================================
// x402 Payment Simulation
// ============================================================================

export interface X402Payment {
  signature: string;
  amountUsdc: number;
  recipient: string;
  resource: string;
  timestamp: number;
}

export function buildX402PaymentHeader(
  signature: string,
  resource: string,
  network: string = SOLANA_NETWORK
): string {
  const payload = {
    scheme: 'exact',
    network: `solana-${network}`,
    payload: signature,
    resource,
  };
  return btoa(JSON.stringify(payload));
}

export function simulateX402Payment(resource: string, agentName: string): string {
  const simSig = `SIM_${agentName}_${Date.now()}`;
  return buildX402PaymentHeader(simSig, resource);
}

// ============================================================================
// Solana Explorer Links
// ============================================================================

export function getExplorerUrl(
  signature: string,
  type: 'tx' | 'address' | 'block' = 'tx'
): string {
  const cluster = SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/${type}/${signature}${cluster}`;
}

export function getSolscanUrl(signature: string): string {
  const cluster = SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/tx/${signature}${cluster}`;
}

// ============================================================================
// Format Utilities
// ============================================================================

export function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4) + ' SOL';
}

export function formatUsdc(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2) + '%';
}

// ============================================================================
// SAS Attestation Types (mirrored from backend)
// ============================================================================

export interface CreditAttestation {
  subjectPubkey: string;
  creditTier: 'AAA' | 'AA' | 'A' | 'B' | 'C';
  interestRateBps: number;
  maxLoanUsdc: number;
  ltvPercent: number;
  attestationId: string;
  onChain: boolean;
  issuedAt: string;
  expiresAt: string;
}

export const CREDIT_TIER_COLORS: Record<string, string> = {
  AAA: '#00ff88',
  AA: '#00d4ff',
  A: '#a78bfa',
  B: '#fbbf24',
  C: '#f87171',
};

export const CREDIT_TIER_LABELS: Record<string, string> = {
  AAA: 'Exceptional',
  AA: 'Very Good',
  A: 'Good',
  B: 'Fair',
  C: 'Limited',
};

// ============================================================================
// Helius WebSocket Event Types
// ============================================================================

export interface HeliusLoanEvent {
  eventType: 'loan_initialized' | 'attestation_verified' | 'negotiation_round' | 'loan_accepted' | 'payment_x402' | 'jupiter_price_check' | 'loan_repaid' | 'collateral_locked';
  message: string;
  slot: number;
  timestamp: string;
  network: string;
  txSignature?: string;
  explorerUrl?: string;
}
