/**
 * Lendora AI - Wallet Connection Hook
 * React hook for managing Solana wallet state (Phantom/wallet-adapter)
 */

import { useState, useEffect, useCallback } from 'react';
import {
    WalletName,
    getAvailableWallets,
    connectWallet,
    disconnectWallet,
    getWalletState,
    subscribeToWalletEvents,
    shortenAddress,
} from '@/lib/wallet/ethereum-wallet';

interface WalletInfo {
    name: WalletName;
    displayName: string;
    installed: boolean;
}

interface UseWalletReturn {
    // Wallet discovery
    installedWallets: WalletInfo[];

    // Connection state
    isConnecting: boolean;
    isConnected: boolean;
    error: string | null;

    // Connected wallet info
    address: string;
    shortAddress: string;
    balance: string;
    network: string;
    chainId: number | null;

    // Actions
    connect: (walletName: WalletName) => Promise<void>;
    disconnect: () => void;
    refreshBalance: () => Promise<void>;
}

const STORAGE_KEY = 'lendora_wallet';
const DISCONNECT_FLAG = 'lendora_wallet_disconnected';

export function useWallet(): UseWalletReturn {
    const [installedWallets, setInstalledWallets] = useState<WalletInfo[]>([]);
    const [address, setAddress] = useState<string>('');
    const [balance, setBalance] = useState<string>('0');
    const [network, setNetwork] = useState<string>('');
    const [chainId, setChainId] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Define refreshBalance early so it can be used in other effects
    const refreshBalance = useCallback(async () => {
        const state = await getWalletState();
        if (state) {
            setBalance(state.balance);
            setNetwork(state.network);
            setChainId(state.chainId);
        }
    }, []);

    // Discover installed wallets on mount
    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 10;

        const checkWallets = () => {
            const wallets = getAvailableWallets();
            if (wallets.some(w => w.installed)) {
                setInstalledWallets(wallets);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkWallets, 500);
            } else {
                setInstalledWallets(wallets);
            }
        };

        checkWallets();

        window.addEventListener('load', checkWallets);
        return () => window.removeEventListener('load', checkWallets);
    }, []);

    // Subscribe to wallet events
    useEffect(() => {
        const unsubscribe = subscribeToWalletEvents(
            (accounts) => {
                // Respect disconnect flag - don't auto-reconnect if user manually disconnected
                if (localStorage.getItem(DISCONNECT_FLAG) === 'true') {
                    return;
                }
                
                if (accounts.length === 0) {
                    // User disconnected
                    setIsConnected(false);
                    setAddress('');
                    setBalance('0');
                    localStorage.removeItem(STORAGE_KEY);
                } else {
                    setIsConnected(true);
                    setAddress(accounts[0]);
                    // Refresh balance on account change
                    refreshBalance();
                }
            },
            (newChainId) => {
                // Respect disconnect flag - don't auto-reconnect if user manually disconnected
                if (localStorage.getItem(DISCONNECT_FLAG) === 'true') {
                    return;
                }
                
                const chainIdNum = parseInt(newChainId, 16);
                setChainId(chainIdNum);
                // Refresh balance on chain change
                refreshBalance();
                // Reload to get new network info
                window.location.reload();
            },
            () => {
                setIsConnected(false);
                setAddress('');
                setBalance('0');
                setNetwork('');
                setChainId(null);
                localStorage.removeItem(STORAGE_KEY);
            }
        );

        return unsubscribe;
    }, [refreshBalance]);

    // Check if already connected on mount and periodically
    useEffect(() => {
        const checkConnection = async () => {
            // Don't auto-reconnect if user manually disconnected
            if (localStorage.getItem(DISCONNECT_FLAG) === 'true') {
                return;
            }

            try {
                const state = await getWalletState();
                if (state && state.connected && state.address) {
                    setIsConnected(true);
                    setAddress(state.address);
                    setBalance(state.balance);
                    setNetwork(state.network);
                    setChainId(state.chainId);
                    setError(null);
                    // Save to localStorage if we have a connection
                    const savedWallet = localStorage.getItem(STORAGE_KEY);
                    if (!savedWallet) {
                        // Try to detect which wallet
                        const solana = (window as Window & { solana?: { isPhantom?: boolean } }).solana;
                        if (solana?.isPhantom) {
                            localStorage.setItem(STORAGE_KEY, 'phantom');
                        }
                    }
                    // DO NOT clear disconnect flag here - only clear it when user explicitly connects
                }
            } catch (err) {
                console.error('[useWallet] Error checking connection:', err);
            }
        };
        
        checkConnection();
        
        // Check periodically to catch connections approved in other tabs
        // Only check if not already connected to avoid unnecessary requests
        const interval = setInterval(() => {
            if (!isConnected && localStorage.getItem(DISCONNECT_FLAG) !== 'true') {
                checkConnection();
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isConnected]);

    const connect = useCallback(async (walletName: WalletName) => {
        setIsConnecting(true);
        setError(null);
        // Clear disconnect flag when user explicitly connects
        localStorage.removeItem(DISCONNECT_FLAG);

        try {
            console.log(`[useWallet] Attempting to connect to ${walletName}...`);
            const state = await connectWallet(walletName);
            
            setIsConnected(true);
            setAddress(state.address || '');
            setBalance(state.balance);
            setNetwork(state.network);
            setChainId(state.chainId);
            localStorage.setItem(STORAGE_KEY, walletName);
            
            console.log(`[useWallet] Connection successful:`, {
                address: state.address?.substring(0, 10) + '...',
                network: state.network
            });
        } catch (err) {
            console.error(`[useWallet] Connection failed:`, err);
            const message = err instanceof Error ? err.message : 'Failed to connect wallet';
            setError(message);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        await disconnectWallet();
        setIsConnected(false);
        setAddress('');
        setBalance('0');
        setNetwork('');
        setChainId(null);
        setError(null);
        localStorage.removeItem(STORAGE_KEY);
        // Set flag to prevent auto-reconnection
        localStorage.setItem(DISCONNECT_FLAG, 'true');
    }, []);

    return {
        installedWallets,
        isConnecting,
        isConnected,
        error,
        address,
        shortAddress: address ? shortenAddress(address) : '',
        balance,
        network,
        chainId,
        connect,
        disconnect,
        refreshBalance,
    };
}


