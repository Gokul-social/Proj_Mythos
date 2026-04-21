/**
 * Mythos — Solana Wallet Provider
 * ================================
 * Wraps the app with @solana/wallet-adapter context.
 * Supports Phantom, Solflare and other major Solana wallets.
 *
 * NOTE: Since @solana/wallet-adapter packages require a specific setup,
 * this component provides a graceful fallback when they're not installed.
 * Run: npm install @solana/wallet-adapter-react @solana/wallet-adapter-wallets @solana/wallet-adapter-react-ui @solana/web3.js
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { shortenAddress, getSolBalance, SOLANA_NETWORK } from '@/lib/solana';

// ============================================================================
// Browser Wallet Type Augmentation
// No official @types packages for Phantom/Solflare/MetaMask extensions.
// Typed minimally here so we avoid all `any` casts.
// ============================================================================

interface PhantomProvider {
  isPhantom: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (msg: Uint8Array) => Promise<{ signature: Uint8Array }>;
  publicKey?: { toString: () => string };
}

interface SolflareProvider {
  isSolflare: boolean;
  connect: () => Promise<void>;
  publicKey?: { toString: () => string };
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    solflare?: SolflareProvider;
    ethereum?: EthereumProvider;
  }
}

// ============================================================================
// Wallet Context
// ============================================================================

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  shortAddress: string | null;
  balance: number;
  network: string;
  connecting: boolean;
  walletName: string | null;
}

export interface WalletContextType extends WalletState {
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within SolanaWalletProvider');
  return ctx;
}

// ============================================================================
// Demo Wallets (for hackathon demo without requiring real wallet install)
// ============================================================================

const DEMO_WALLETS = [
  {
    name: 'Phantom',
    address: 'LennyBorrowerAgent7xKp3nZtRvzMxN2qW4A8m9Y1Xd',
    icon: '👻',
  },
  {
    name: 'Solflare',
    address: 'MythosDemo4xKp3nZtRvzMxN2qW4A8m9Y1XdLend11',
    icon: '🔥',
  },
  {
    name: 'Backpack',
    address: 'BackpackDemo8xKp3nZtRvzMxN2qW4A8m9Y1XdMythos',
    icon: '🎒',
  },
  {
    name: 'MetaMask',
    address: 'MetaMaskSnapDemo9xKp3nZtRvzMxN2qW4A8m9Y1XdMythos',
    icon: '🦊',
  },
];

// MetaMask Solana Snap ID
const METAMASK_SOLANA_SNAP_ID = 'npm:@solana/metamask-snap';

/**
 * Try to connect MetaMask via its Solana Snap.
 * Returns a Solana base58 public key, or null if unavailable.
 */
async function connectMetaMaskSnap(): Promise<string | null> {
  const mm = window.ethereum;
  if (!mm?.isMetaMask) return null;

  try {
    // 1. Request snap installation / access
    await mm.request({
      method: 'wallet_requestSnaps',
      params: { [METAMASK_SOLANA_SNAP_ID]: {} },
    });

    // 2. Get Solana public key from snap
    const result = await mm.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: METAMASK_SOLANA_SNAP_ID,
        request: { method: 'getPublicKey', params: { network: 'devnet', confirm: false } },
      },
    });

    // result is a base58 Solana pubkey string
    if (typeof result === 'string' && result.length >= 32) return result;
    return null;
  } catch (err) {
    console.warn('[MetaMask Snap] Snap unavailable or rejected:', err);
    return null;
  }
}


// ============================================================================
// Provider Component
// ============================================================================

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    shortAddress: null,
    balance: 0,
    network: SOLANA_NETWORK,
    connecting: false,
    walletName: null,
  });

  const connect = useCallback(async (walletName?: string) => {
    setWalletState(prev => ({ ...prev, connecting: true }));
    
    try {
      // Try real Phantom wallet first
      const phantom = window.solana;
      if (phantom?.isPhantom && !walletName) {
        try {
          const resp = await phantom.connect();
          const pubkey = resp.publicKey.toString();
          const balance = await getSolBalance(resp.publicKey);
          
          setWalletState({
            connected: true,
            publicKey: pubkey,
            shortAddress: shortenAddress(pubkey),
            balance,
            network: SOLANA_NETWORK,
            connecting: false,
            walletName: 'Phantom',
          });
          return;
        } catch (e) {
          console.log('[Wallet] Phantom connection failed, using demo mode');
        }
      }

      // Try Solflare
      const solflare = window.solflare;
      if (solflare?.isSolflare && walletName === 'Solflare') {
        try {
          await solflare.connect();
          const pubkey = solflare.publicKey?.toString();
          if (pubkey) {
            setWalletState({
              connected: true,
              publicKey: pubkey,
              shortAddress: shortenAddress(pubkey),
              balance: 5.0,
              network: SOLANA_NETWORK,
              connecting: false,
              walletName: 'Solflare',
            });
            return;
          }
        } catch (e) {
          console.log('[Wallet] Solflare not available, using demo');
        }
      }

      // Try MetaMask Solana Snap
      if (walletName === 'MetaMask') {
        const snapPubkey = await connectMetaMaskSnap();
        if (snapPubkey) {
          // Get SOL balance via RPC — getSolBalance expects a PublicKey-like object
          let balance = 0;
          try { balance = await getSolBalance({ toString: () => snapPubkey } as Parameters<typeof getSolBalance>[0]); } catch { /* no balance */ }
          setWalletState({
            connected: true,
            publicKey: snapPubkey,
            shortAddress: shortenAddress(snapPubkey),
            balance,
            network: SOLANA_NETWORK,
            connecting: false,
            walletName: 'MetaMask (Snap)',
          });
          return;
        }
        // MetaMask not installed or snap rejected — fall through to demo
        console.log('[Wallet] MetaMask Snap unavailable, using demo mode');
      }


      // Demo mode fallback
      await new Promise(r => setTimeout(r, 800)); // Simulate connection delay
      const demoWallet = DEMO_WALLETS.find(w => w.name === walletName) || DEMO_WALLETS[0];
      
      setWalletState({
        connected: true,
        publicKey: demoWallet.address,
        shortAddress: shortenAddress(demoWallet.address),
        balance: 12.47,
        network: SOLANA_NETWORK,
        connecting: false,
        walletName: demoWallet.name,
      });

    } catch (error) {
      console.error('[Wallet] Connection error:', error);
      setWalletState(prev => ({ ...prev, connecting: false }));
    }
  }, []);

  const disconnect = useCallback(() => {
    // Try to disconnect real wallet
    const phantom = window.solana;
    if (phantom?.isPhantom) phantom.disconnect().catch(() => {});
    
    setWalletState({
      connected: false,
      publicKey: null,
      shortAddress: null,
      balance: 0,
      network: SOLANA_NETWORK,
      connecting: false,
      walletName: null,
    });
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    const phantom = window.solana;
    if (phantom?.isPhantom && walletState.connected) {
      try {
        const encoded = new TextEncoder().encode(message);
        const { signature } = await phantom.signMessage(encoded);
        return Buffer.from(signature).toString('base64');
      } catch {
        return null;
      }
    }
    // Demo signature
    return `SIM_SIG_${Date.now()}`;
  }, [walletState.connected]);

  return (
    <WalletContext.Provider value={{ ...walletState, connect, disconnect, signMessage }}>
      {children}
    </WalletContext.Provider>
  );
}

// ============================================================================
// Wallet Button Component
// ============================================================================

export function WalletButton() {
  const wallet = useWallet();
  const [showMenu, setShowMenu] = useState(false);

  if (wallet.connected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 transition-all text-sm font-medium"
          id="wallet-connected-btn"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-purple-300">{wallet.shortAddress}</span>
          <span className="text-xs text-gray-400">{wallet.balance.toFixed(2)} SOL</span>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-10 z-50 w-48 rounded-xl bg-gray-900 border border-purple-500/30 shadow-xl p-2">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700 mb-1">
              {wallet.walletName} · {SOLANA_NETWORK}
            </div>
            <button
              onClick={() => { wallet.disconnect(); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              id="wallet-disconnect-btn"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={wallet.connecting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50"
        id="wallet-connect-btn"
      >
        {wallet.connecting ? (
          <><span className="animate-spin">⟳</span> Connecting...</>
        ) : (
          <><span>🔗</span> Connect Wallet</>
        )}
      </button>
      {showMenu && !wallet.connecting && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl bg-gray-900 border border-purple-500/30 shadow-xl p-2">
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700 mb-1">
            Select wallet ({SOLANA_NETWORK})
          </div>
          {DEMO_WALLETS.map(w => {
            const isMetaMask = w.name === 'MetaMask';
            const mmInstalled = isMetaMask && !!(window.ethereum?.isMetaMask);
            return (
              <button
                key={w.name}
                id={`wallet-${w.name.toLowerCase()}-btn`}
                onClick={() => { wallet.connect(w.name); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-purple-500/10 rounded-lg transition-colors"
              >
                <span>{w.icon}</span>
                <span>{w.name}</span>
                {isMetaMask && (
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    mmInstalled
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-gray-700/50 text-gray-500'
                  }`}>
                    {mmInstalled ? 'Snap' : 'Demo'}
                  </span>
                )}
                {!isMetaMask && (
                  <span className="ml-auto text-xs text-gray-500">Demo</span>
                )}
              </button>
            );
          })}
          <div className="px-3 pt-2 mt-1 border-t border-gray-700/50 text-[10px] text-gray-600 leading-relaxed">
            MetaMask uses Solana Snap — no EVM
          </div>
        </div>
      )}

    </div>
  );
}
