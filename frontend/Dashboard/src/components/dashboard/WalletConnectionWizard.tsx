/**
 * Simplified Wallet Connection for Wizard
 * Neutral, informational error messages
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/hooks/useWallet';
import { getWalletState } from '@/lib/wallet/ethereum-wallet';
import { Wallet, Check, Edit2, X } from 'lucide-react';
import type { WalletName } from '@/lib/wallet/ethereum-wallet';

interface WalletConnectionWizardProps {
    onConnect: (address: string) => void;
    role: 'borrower' | 'lender' | null;
}

export function WalletConnectionWizard({ onConnect, role }: WalletConnectionWizardProps) {
    const {
        installedWallets,
        isConnecting,
        isConnected,
        error,
        address,
        shortAddress,
        connect,
        disconnect,
    } = useWallet();

    const [manualAddress, setManualAddress] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [localError, setLocalError] = useState<string | null>(null);
    const hasConnectedRef = useRef(false);
    const connectionAttemptRef = useRef<WalletName | null>(null);

    const handleConnect = async (walletName: WalletName) => {
        connectionAttemptRef.current = walletName;
        setRetryCount(0);
        setLocalError(null);
        try {
            await connect(walletName);
        } catch (err) {
            console.error('Connection error:', err);
        }
    };

    const handleRetry = async () => {
        if (connectionAttemptRef.current) {
            setRetryCount(prev => prev + 1);
            
            // First check if already connected
            try {
                const state = await getWalletState();
                if (state && state.connected && state.address) {
                    // Already connected, just update the hook state
                    // The useWallet hook should detect this via event listeners
                    // Force a refresh by triggering a state check
                    console.log('[Wizard] Found existing connection, updating state...');
                    // The hook will pick this up via the periodic check
                    return;
                }
            } catch (err) {
                console.error('Error checking connection state:', err);
            }
            
            // If not connected, try connecting again
            try {
                await connect(connectionAttemptRef.current);
            } catch (err) {
                console.error('Retry connection error:', err);
            }
        }
    };

    const handleCheckConnection = async () => {
        try {
            const state = await getWalletState();
            if (state && state.connected && state.address) {
                // Force connection by calling connect with the same wallet
                if (connectionAttemptRef.current) {
                    await connect(connectionAttemptRef.current);
                } else {
                    // If no connection attempt ref, try to detect wallet
                    const wallets = installedWallets.filter(w => w.installed);
                    if (wallets.length > 0) {
                        await connect(wallets[0].name as WalletName);
                    }
                }
            } else {
                // Not connected, show message
                setLocalError('No connection found. Please click the Phantom button to connect.');
            }
        } catch (err) {
            console.error('Check connection error:', err);
        }
    };

    // Poll for connection status when error indicates pending
    useEffect(() => {
        if (error && error.includes('pending') && !isConnecting && connectionAttemptRef.current) {
            let pollCount = 0;
            const maxPolls = 30; // Poll for up to 60 seconds (30 * 2s)
            
            const pollInterval = setInterval(async () => {
                pollCount++;
                if (pollCount > maxPolls) {
                    clearInterval(pollInterval);
                    return;
                }
                
                try {
                    const state = await getWalletState();
                    if (state && state.connected && state.address) {
                        console.log('[Wizard] Polling detected connection, updating...');
                        clearInterval(pollInterval);
                        
                        // Connection was approved, trigger connect to update hook state
                        if (connectionAttemptRef.current) {
                            try {
                                await connect(connectionAttemptRef.current);
                            } catch (err) {
                                // If connect fails but we have state, the hook should still update
                                console.log('[Wizard] Connect call failed but state exists, hook should update');
                            }
                        }
                    }
                } catch (err) {
                    console.error('[Wizard] Polling error:', err);
                }
            }, 2000); // Poll every 2 seconds

            return () => clearInterval(pollInterval);
        }
    }, [error, isConnecting, connect]);


    const isValidAddress = (addr: string) => {
        return addr && addr.startsWith('0x') && addr.length === 42;
    };

    // Auto-advance when wallet connects (only once)
    useEffect(() => {
        if (isConnected && address && isValidAddress(address) && !hasConnectedRef.current) {
            hasConnectedRef.current = true;
            onConnect(address);
        }
    }, [isConnected, address, onConnect]);

    const walletIcons: Record<string, string> = {
        phantom: '👻',
        coinbase: 'ðŸ”µ',
        walletconnect: 'ðŸ”—',
        trust: 'ðŸ›¡ï¸',
        rainbow: 'ðŸŒˆ',
    };

    return (
        <div className="space-y-6">
            {isConnected && address && isValidAddress(address) ? (
                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-3 mb-2">
                            <Check className="w-5 h-5 text-primary" />
                            <div>
                                <p className="font-medium text-foreground">Wallet Connected</p>
                                <p className="text-sm text-muted-foreground font-mono">{shortAddress}</p>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={disconnect}
                        className="w-full"
                    >
                        Disconnect
                    </Button>
                </div>
            ) : (
                <>
                    {/* Wallet Options */}
                    <div>
                        <Label className="text-sm mb-3 block">Connect Wallet</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {installedWallets
                                .filter(w => w.installed)
                                .map((wallet) => (
                                    <Button
                                        key={wallet.name}
                                        variant="outline"
                                        onClick={() => handleConnect(wallet.name)}
                                        disabled={isConnecting}
                                        className="justify-start"
                                    >
                                        <span className="mr-2">{walletIcons[wallet.name] || 'ðŸ’³'}</span>
                                        {wallet.displayName}
                                    </Button>
                                ))}
                        </div>
                        {installedWallets.filter(w => w.installed).length === 0 && (
                            <p className="text-sm text-muted-foreground mt-3">
                                No wallets detected. Install Phantom or another Solana wallet extension.
                            </p>
                        )}
                    </div>

                    {/* Manual Address Input */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-sm">Or Enter Address Manually</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsManualMode(!isManualMode)}
                            >
                                {isManualMode ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            </Button>
                        </div>
                        {isManualMode && (
                            <div className="space-y-3">
                                <Input
                                    placeholder="0x..."
                                    value={manualAddress}
                                    onChange={(e) => setManualAddress(e.target.value)}
                                    className="font-mono text-sm"
                                />
                                <Button
                                    onClick={() => {
                                        if (manualAddress && isValidAddress(manualAddress)) {
                                            onConnect(manualAddress);
                                        }
                                    }}
                                    disabled={!manualAddress || !isValidAddress(manualAddress)}
                                    className="w-full"
                                >
                                    Continue
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Enter your Solana wallet address to continue
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Neutral informational messages */}
                    {error && (
                        <div className="p-4 rounded-lg bg-muted border border-border space-y-3">
                            <div>
                                <p className="text-sm font-medium text-foreground mb-1">Connection Information</p>
                                <p className="text-xs text-muted-foreground">{error}</p>
                            </div>
                            {error.includes('pending') && (
                                <>
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-foreground">Steps to connect:</p>
                                        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside ml-2">
                                            <li>Look for the Phantom extension icon in your browser toolbar</li>
                                            <li>Click the Phantom icon to open the extension</li>
                                            <li>Approve the connection request if you see one</li>
                                            <li>Make sure Phantom is unlocked</li>
                                            <li>Click "Check Connection" below after approving</li>
                                        </ol>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleCheckConnection}
                                            disabled={isConnecting}
                                            className="flex-1"
                                        >
                                            {isConnecting ? 'Checking...' : 'Check Connection'}
                                        </Button>
                                        <Button
                                            onClick={handleRetry}
                                            disabled={isConnecting}
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            {isConnecting ? 'Connecting...' : `Retry${retryCount > 0 ? ` (${retryCount})` : ''}`}
                                        </Button>
                                    </div>
                                </>
                            )}
                            {error.includes('rejected') && (
                                <Button
                                    onClick={() => {
                                        if (connectionAttemptRef.current) {
                                            handleConnect(connectionAttemptRef.current);
                                        }
                                    }}
                                    disabled={isConnecting}
                                    className="w-full"
                                >
                                    {isConnecting ? 'Connecting...' : 'Try Again'}
                                </Button>
                            )}
                        </div>
                    )}

                    {isConnecting && (
                        <div className="p-3 rounded-lg bg-muted border border-border">
                            <p className="text-sm text-foreground">Connecting to wallet...</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}



