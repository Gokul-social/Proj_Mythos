/**
 * Lendora AI - Portfolio Page
 * Shows real wallet balance, total borrowed/lent, and account summary
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useWallet } from '@/hooks/useWallet';
import { useLendoraData } from '@/hooks/useLendoraData';
import { Wallet, ArrowDown, ArrowUp, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import CountUp from 'react-countup';

interface PortfolioStats {
    totalBorrowed: number;
    totalLent: number;
    activeLoansBorrowed: number;
    activeLoansLent: number;
    totalInterestPaid: number;
    totalInterestEarned: number;
}

export default function Portfolio() {
    const { address, balance, isConnected, network } = useWallet();
    const { dashboard, loading: dataLoading } = useLendoraData();
    const [stats, setStats] = useState<PortfolioStats>({
        totalBorrowed: 0,
        totalLent: 0,
        activeLoansBorrowed: 0,
        activeLoansLent: 0,
        totalInterestPaid: 0,
        totalInterestEarned: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (dashboard) {
            // Use mock data from useLendoraData
            setStats({
                totalBorrowed: dashboard.totalBorrowed,
                totalLent: dashboard.totalSupplied,
                activeLoansBorrowed: 2,
                activeLoansLent: 3,
                totalInterestPaid: 125.50,
                totalInterestEarned: 342.75,
            });
            setLoading(false);
        } else if (!dataLoading) {
            setLoading(false);
        }
    }, [dashboard, dataLoading]);

    const walletBalance = parseFloat(balance || '0');
    const netPosition = stats.totalLent - stats.totalBorrowed;

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="glass-card p-8 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                    <p className="text-muted-foreground">
                        Please connect your Solana wallet (Phantom) to view your portfolio
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Wallet Balance Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Card className="glass-card p-6 border-2 border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                <Wallet className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                                <p className="text-2xl font-bold text-foreground">
                                    {loading ? (
                                        'Loading...'
                                    ) : (
                                        <>
                                            <CountUp end={walletBalance} duration={1} decimals={4} /> ETH
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-sm">
                            {network}
                        </Badge>
                    </div>
                    <div className="pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground font-mono">{address}</p>
                    </div>
                </Card>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Borrowed */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <ArrowDown className="w-5 h-5 text-red-500" />
                            <Badge variant="outline" className="text-xs">
                                {stats.activeLoansBorrowed} active
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">Total Borrowed</p>
                        <p className="text-2xl font-bold text-foreground">
                            <CountUp end={stats.totalBorrowed} duration={1} decimals={2} prefix="$" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Interest paid: <CountUp end={stats.totalInterestPaid} duration={1} decimals={2} prefix="$" />
                        </p>
                    </Card>
                </motion.div>

                {/* Total Lent */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <ArrowUp className="w-5 h-5 text-green-500" />
                            <Badge variant="outline" className="text-xs">
                                {stats.activeLoansLent} active
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">Total Lent</p>
                        <p className="text-2xl font-bold text-foreground">
                            <CountUp end={stats.totalLent} duration={1} decimals={2} prefix="$" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Interest earned: <CountUp end={stats.totalInterestEarned} duration={1} decimals={2} prefix="$" />
                        </p>
                    </Card>
                </motion.div>

                {/* Net Position */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <TrendingUp className={`w-5 h-5 ${netPosition >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                            <Badge variant={netPosition >= 0 ? 'default' : 'destructive'} className="text-xs">
                                {netPosition >= 0 ? 'Positive' : 'Negative'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">Net Position</p>
                        <p className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            <CountUp end={netPosition} duration={1} decimals={2} prefix="$" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            {netPosition >= 0 ? 'You are a net lender' : 'You are a net borrower'}
                        </p>
                    </Card>
                </motion.div>

                {/* Total Value */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <DollarSign className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">Total Value</p>
                        <p className="text-2xl font-bold text-foreground">
                            <CountUp 
                                end={walletBalance * 3000 + netPosition} 
                                duration={1} 
                                decimals={2} 
                                prefix="$" 
                            />
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Wallet + Loans (ETH @ ~$3000)
                        </p>
                    </Card>
                </motion.div>
            </div>

            {/* Account Summary */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <Card className="glass-card p-6">
                    <h2 className="text-xl font-semibold mb-4 text-foreground">Account Summary</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                                <span className="text-sm text-muted-foreground">Active Borrowed Loans</span>
                                <span className="font-semibold text-foreground">{stats.activeLoansBorrowed}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                                <span className="text-sm text-muted-foreground">Active Lent Loans</span>
                                <span className="font-semibold text-foreground">{stats.activeLoansLent}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                                <span className="text-sm text-muted-foreground">Total Interest Paid</span>
                                <span className="font-semibold text-red-500">
                                    $<CountUp end={stats.totalInterestPaid} duration={1} decimals={2} />
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                                <span className="text-sm text-muted-foreground">Total Interest Earned</span>
                                <span className="font-semibold text-green-500">
                                    $<CountUp end={stats.totalInterestEarned} duration={1} decimals={2} />
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}
