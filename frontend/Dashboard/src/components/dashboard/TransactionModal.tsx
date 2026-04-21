/**
 * Lendora AI - Transaction Modal
 * Reusable modal for Supply and Borrow actions
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Coins, ArrowUp, ArrowDown, Loader2, CheckCircle2, AlertCircle, Fuel } from 'lucide-react';
import { StablecoinLogo, Stablecoin } from '@/lib/stablecoinLogos';
import { useLendora } from '@/context/LendoraContext';
import { useWallet } from '@/hooks/useWallet';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

// Asset data interface matching MarketAsset
export interface TransactionAsset {
    symbol: string;
    name: string;
    supplyRate: number;
    borrowRate: number;
    totalLiquidity: number;
    totalBorrowed: number;
    utilizationRate: number;
}

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'supply' | 'borrow';
    asset: TransactionAsset | null;
}

type ModalState = 'input' | 'loading' | 'success' | 'error';

// Mock wallet balance for demonstration
const MOCK_WALLET_BALANCE = 10000;
const MOCK_GAS_FEE = 0.0012; // ETH

export function TransactionModal({ isOpen, onClose, type, asset }: TransactionModalProps) {
    const [amount, setAmount] = useState<string>('');
    const [modalState, setModalState] = useState<ModalState>('input');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const { addLoan } = useLendora();
    const { address, balance } = useWallet();
    const navigate = useNavigate();

    // Reset state when modal opens/closes and handle body scroll lock
    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setModalState('input');
            setErrorMessage('');
            // Prevent background scrolling when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            // Restore scrolling when modal closes
            document.body.style.overflow = '';
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!asset) return null;

    const isSupply = type === 'supply';
    const apy = isSupply ? asset.supplyRate : asset.borrowRate;
    const availableLiquidity = asset.totalLiquidity - asset.totalBorrowed;
    const numericAmount = parseFloat(amount) || 0;

    // Validation checks
    const isAmountValid = numericAmount > 0;
    const exceedsBalance = isSupply && numericAmount > MOCK_WALLET_BALANCE;
    const exceedsLiquidity = !isSupply && numericAmount > availableLiquidity;
    const isDisabled = !isAmountValid || exceedsBalance || exceedsLiquidity || modalState === 'loading';

    // Calculate new wallet balance (mock)
    const newWalletBalance = isSupply
        ? MOCK_WALLET_BALANCE - numericAmount
        : MOCK_WALLET_BALANCE + numericAmount;

    // Calculate expected earnings/cost (1 year)
    const expectedYearlyReturn = (numericAmount * apy) / 100;

    const handleConfirm = async () => {
        // Validation
        if (!isAmountValid) {
            setErrorMessage('Please enter an amount greater than 0');
            return;
        }

        if (exceedsBalance) {
            setErrorMessage('Amount exceeds your wallet balance');
            return;
        }

        if (exceedsLiquidity) {
            setErrorMessage('Amount exceeds available market liquidity');
            return;
        }

        setModalState('loading');

        // Simulate blockchain transaction (1.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
            // Add loan to global state
            addLoan({
                asset: asset.symbol,
                amount: numericAmount,
                type: isSupply ? 'lend' : 'borrow',
                apy: apy,
                status: 'active',
                termMonths: 12,
                walletAddress: address || '0x0000...0000',
                counterpartyAddress: '0xLendora...Pool',
            });

            setModalState('success');

            // Show toast notification
            toast({
                title: isSupply ? 'Supply Successful!' : 'Borrow Successful!',
                description: `Your ${numericAmount.toLocaleString()} ${asset.symbol} ${isSupply ? 'supply' : 'borrow'} has been processed.`,
            });

        } catch (error) {
            setModalState('error');
            setErrorMessage('Transaction failed. Please try again.');
        }
    };

    const handleViewLoans = () => {
        onClose();
        navigate('/loans');
    };

    const handleClose = () => {
        if (modalState !== 'loading') {
            onClose();
        }
    };

    // Render asset icon
    const AssetIcon = () => {
        const stablecoins: Stablecoin[] = ['USDC', 'DAI', 'USDT', 'TUSD', 'BUSD', 'USDD'];
        if (stablecoins.includes(asset.symbol as Stablecoin)) {
            return <StablecoinLogo symbol={asset.symbol as Stablecoin} size={48} />;
        }
        return (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="w-6 h-6 text-primary" />
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md glass-card border-primary/20">
                <AnimatePresence mode="wait">
                    {/* Input State */}
                    {modalState === 'input' && (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <DialogHeader>
                                <div className="flex items-center gap-4 mb-2">
                                    <AssetIcon />
                                    <div>
                                        <DialogTitle className="text-xl flex items-center gap-2">
                                            {isSupply ? (
                                                <ArrowUp className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <ArrowDown className="w-5 h-5 text-red-500" />
                                            )}
                                            {isSupply ? 'Supply' : 'Borrow'} {asset.symbol}
                                        </DialogTitle>
                                        <DialogDescription className="text-muted-foreground">
                                            {asset.name}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-6 py-4">
                                {/* Amount Input */}
                                <div className="space-y-2">
                                    <Label htmlFor="amount" className="text-foreground font-medium">Amount</Label>
                                    <div className="relative">
                                        <Input
                                            id="amount"
                                            type="number"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="pr-20 text-lg font-mono bg-secondary/30 border-border focus:border-primary transition-colors duration-200 tabular-nums"
                                            min="0"
                                            step="0.01"
                                        />
                                        {/* Absolutely positioned asset tag to prevent layout jumping */}
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50 border border-border pointer-events-none">
                                            <span className="text-sm font-semibold text-foreground">
                                                {asset.symbol}
                                            </span>
                                        </div>
                                    </div>
                                    {isSupply && (
                                        <p className="text-xs text-muted-foreground">
                                            Available: {MOCK_WALLET_BALANCE.toLocaleString()} {asset.symbol}
                                        </p>
                                    )}
                                    {!isSupply && (
                                        <p className="text-xs text-muted-foreground">
                                            Market Liquidity: ${(availableLiquidity / 1000000).toFixed(2)}M
                                        </p>
                                    )}
                                </div>

                                {/* Transaction Details */}
                                <div className="space-y-3 p-4 rounded-lg bg-secondary/20 border border-border">
                                    <h4 className="text-sm font-semibold text-foreground">Transaction Details</h4>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">New Wallet Balance</span>
                                        <span className="text-sm font-semibold text-foreground tabular-nums">
                                            {numericAmount > 0 ? newWalletBalance.toLocaleString() : MOCK_WALLET_BALANCE.toLocaleString()} {asset.symbol}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Expected APY</span>
                                        <span className={`text-sm font-semibold tabular-nums ${isSupply ? 'text-green-500' : 'text-red-500'}`}>
                                            {apy.toFixed(2)}%
                                        </span>
                                    </div>

                                    {numericAmount > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">
                                                Est. {isSupply ? 'Earnings' : 'Cost'} (1Y)
                                            </span>
                                            <span className={`text-sm font-semibold tabular-nums ${isSupply ? 'text-green-500' : 'text-red-500'}`}>
                                                {isSupply ? '+' : '-'}${expectedYearlyReturn.toFixed(2)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-border">
                                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <Fuel className="w-3.5 h-3.5" />
                                            Gas Fee (Est.)
                                        </span>
                                        <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                                            ~{MOCK_GAS_FEE} ETH
                                        </span>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {errorMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30"
                                    >
                                        <AlertCircle className="w-4 h-4 text-destructive" />
                                        <span className="text-sm text-destructive">{errorMessage}</span>
                                    </motion.div>
                                )}

                                {/* Validation Warnings */}
                                {exceedsBalance && !errorMessage && (
                                    <p className="text-sm text-destructive flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        Amount exceeds your wallet balance
                                    </p>
                                )}
                                {exceedsLiquidity && !errorMessage && (
                                    <p className="text-sm text-destructive flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        Amount exceeds available market liquidity
                                    </p>
                                )}
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    className="transition-all duration-200 hover:bg-secondary/80"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    disabled={isDisabled}
                                    className={`transition-all duration-200 ${isSupply
                                        ? 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
                                        : 'bg-primary hover:bg-primary/90 active:scale-[0.98]'
                                    }`}
                                >
                                    Confirm {isSupply ? 'Supply' : 'Borrow'}
                                </Button>
                            </DialogFooter>
                        </motion.div>
                    )}

                    {/* Loading State */}
                    {modalState === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center py-12"
                        >
                            <div className="relative">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                >
                                    <Loader2 className="w-12 h-12 text-primary" />
                                </motion.div>
                            </div>
                            <h3 className="text-lg font-semibold mt-6 text-foreground">
                                Processing Transaction
                            </h3>
                            <p className="text-sm text-muted-foreground mt-2 text-center">
                                Please wait while your {isSupply ? 'supply' : 'borrow'} is being processed on the blockchain...
                            </p>
                            <div className="flex items-center gap-2 mt-4">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </motion.div>
                    )}

                    {/* Success State */}
                    {modalState === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center py-8"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                                className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center"
                            >
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </motion.div>

                            <h3 className="text-xl font-semibold mt-6 text-foreground">
                                Transaction Successful!
                            </h3>

                            <p className="text-sm text-muted-foreground mt-2 text-center">
                                Your {numericAmount.toLocaleString()} {asset.symbol} has been {isSupply ? 'supplied' : 'borrowed'} successfully.
                            </p>

                            <div className="mt-6 p-4 rounded-lg bg-secondary/30 border border-border w-full">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-muted-foreground">Amount</span>
                                    <span className="text-sm font-semibold text-foreground tabular-nums">
                                        {numericAmount.toLocaleString()} {asset.symbol}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">APY</span>
                                    <span className={`text-sm font-semibold tabular-nums ${isSupply ? 'text-green-500' : 'text-red-500'}`}>
                                        {apy.toFixed(2)}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6 w-full">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    className="flex-1 transition-all duration-200 hover:bg-secondary/80"
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={handleViewLoans}
                                    className="flex-1 transition-all duration-200 active:scale-[0.98]"
                                >
                                    View My Loans
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Error State */}
                    {modalState === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center py-8"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                                className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center"
                            >
                                <AlertCircle className="w-10 h-10 text-destructive" />
                            </motion.div>

                            <h3 className="text-xl font-semibold mt-6 text-foreground">
                                Transaction Failed
                            </h3>

                            <p className="text-sm text-muted-foreground mt-2 text-center">
                                {errorMessage || 'Something went wrong. Please try again.'}
                            </p>

                            <div className="flex gap-3 mt-6 w-full">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    className="flex-1 transition-all duration-200 hover:bg-secondary/80"
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={() => setModalState('input')}
                                    className="flex-1 transition-all duration-200 active:scale-[0.98]"
                                >
                                    Try Again
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}

export default TransactionModal;

