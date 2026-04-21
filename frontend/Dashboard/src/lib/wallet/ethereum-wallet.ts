/**
 * Mythos — Solana Wallet Stub
 *
 * This file replaces the legacy Ethereum wallet integration.
 * All real wallet connectivity is now handled by SolanaWalletProvider
 * (Phantom / @solana/wallet-adapter-react).
 *
 * This stub exports the minimum types/functions referenced by legacy
 * dashboard pages (Portfolio, Loans, Transactions, LoginGate) so the
 * TypeScript build does not break.  Those pages are kept in the repo
 * but are not reachable via the active routes (/ and /mythos only).
 */

export type WalletName = 'phantom' | 'solflare' | 'backpack' | 'brave';

export interface WalletState {
  address: string | null;
  network: string | null;
  balance: string | null;
  connected: boolean;
  walletName: WalletName | null;
  /** @deprecated use connected — kept for backward compat with legacy hook */
  chainId: number | null;
  /** @deprecated — Solana wallets don't have accounts array */
  length: number;
}

export interface WalletInfo {
  name: WalletName;
  displayName: string;
  installed: boolean;
  icon: string;
}

export function getInstalledWallets(): WalletInfo[] {
  const hasPhantom =
    typeof window !== 'undefined' && !!(window as Window & { solana?: { isPhantom?: boolean } }).solana?.isPhantom;
  return [
    { name: 'phantom',  displayName: 'Phantom',  installed: hasPhantom, icon: '👻' },
    { name: 'solflare', displayName: 'Solflare', installed: false,       icon: '🌟' },
    { name: 'backpack', displayName: 'Backpack', installed: false,       icon: '🎒' },
  ];
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export async function connectWallet(_name: WalletName = 'phantom'): Promise<WalletState> {
  throw new Error('Use SolanaWalletProvider / useWallet from @solana/wallet-adapter-react instead.');
}

export async function disconnectWallet(): Promise<void> {
  // No-op — managed by Solana wallet adapter
}

/** Alias for backward compat with legacy useWallet.ts */
export const getAvailableWallets = getInstalledWallets;

export async function getWalletState(): Promise<WalletState> {
  return { address: null, network: 'devnet', balance: null, connected: false, walletName: null, chainId: null, length: 0 };
}

export function subscribeToWalletEvents(
  _onAccounts?: (accounts: string[]) => void,
  _onChain?: (chainId: string) => void,
  _onDisconnect?: () => void
): () => void {
  return () => {}; // No-op — subscriptions managed by wallet adapter
}

export function debugWallet(): void {
  const sol = (window as Window & { solana?: unknown }).solana;
  console.log('=== Mythos Solana Wallet Debug ===');
  console.log('Phantom available:', !!sol);
}
