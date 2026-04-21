/**
 * Lendora AI - Loans Page
 * Shows detailed history of borrowed and lent loans from global state
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { useWallet } from '@/hooks/useWallet';
import { useLendora, Loan } from '@/context/LendoraContext';
import { ArrowDown, ArrowUp, Clock, CheckCircle2, XCircle, AlertCircle, ExternalLink, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Loans() {
    const { isConnected } = useWallet();
    const { loans, totalBorrowed, totalLent } = useLendora();
    const navigate = useNavigate();

    // Filter loans by type
    const borrowedLoans = loans.filter(loan => loan.type === 'borrow');
    const lentLoans = loans.filter(loan => loan.type === 'lend');

    // Count active loans
    const activeBorrowedCount = borrowedLoans.filter(l => l.status === 'active').length;
    const activeLentCount = lentLoans.filter(l => l.status === 'active').length;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-blue-500">Active</Badge>;
            case 'completed':
                return <Badge className="bg-green-500">Completed</Badge>;
            case 'defaulted':
                return <Badge variant="destructive">Defaulted</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500">Pending</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <Clock className="w-4 h-4 text-blue-500" />;
            case 'completed':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'defaulted':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'pending':
                return <Clock className="w-4 h-4 text-yellow-500" />;
            default:
                return <AlertCircle className="w-4 h-4 text-gray-500" />;
        }
    };

    const LoanCard = ({ loan }: { loan: Loan }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Card className="glass-card p-5 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {loan.type === 'borrow' ? (
                            <ArrowDown className="w-6 h-6 text-red-500" />
                        ) : (
                            <ArrowUp className="w-6 h-6 text-green-500" />
                        )}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">
                                    {loan.amount.toLocaleString()} {loan.asset}
                                </h3>
                                {getStatusBadge(loan.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {loan.type === 'borrow' ? 'Borrowed from' : 'Lent to'}{' '}
                                {loan.counterpartyAddress 
                                    ? loan.counterpartyAddress.slice(0, 6) + '...' + loan.counterpartyAddress.slice(-4)
                                    : 'Unknown'
                                }
                            </p>
                        </div>
                    </div>
                    {getStatusIcon(loan.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                        <p className="font-semibold text-foreground">{loan.apy}% APR</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Term</p>
                        <p className="font-semibold text-foreground">{loan.termMonths} months</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                        <p className="font-semibold text-foreground text-sm">
                            {format(new Date(loan.startDate), 'MMM dd, yyyy')}
                        </p>
                    </div>
                    {loan.endDate && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">End Date</p>
                            <p className="font-semibold text-foreground text-sm">
                                {format(new Date(loan.endDate), 'MMM dd, yyyy')}
                            </p>
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Wallet Address</span>
                        <span className="font-mono text-xs text-foreground">
                            {loan.walletAddress.slice(0, 6)}...{loan.walletAddress.slice(-4)}
                        </span>
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                        View Details
                    </Button>
                    <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                </div>
            </Card>
        </motion.div>
    );

    const EmptyState = ({ type }: { type: 'borrowed' | 'lent' }) => (
        <Card className="glass-card p-8 text-center">
            {type === 'borrowed' ? (
                <ArrowDown className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            ) : (
                <ArrowUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <h3 className="text-xl font-semibold mb-2">
                No {type === 'borrowed' ? 'Borrowed' : 'Lent'} Loans
            </h3>
            <p className="text-muted-foreground mb-4">
                You haven't {type === 'borrowed' ? 'borrowed any loans' : 'lent any funds'} yet
            </p>
            <Button 
                onClick={() => navigate('/dashboard')}
                className="gap-2"
            >
                <Plus className="w-4 h-4" />
                Create a Loan
            </Button>
        </Card>
    );

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="glass-card p-8 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                    <p className="text-muted-foreground">
                        Please connect your Solana wallet (Phantom) to view your loans
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <ArrowDown className="w-5 h-5 text-red-500" />
                        <h3 className="font-semibold text-foreground">Total Borrowed</h3>
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-1">
                        ${totalBorrowed.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {activeBorrowedCount} active loan{activeBorrowedCount !== 1 ? 's' : ''}
                    </p>
                </Card>

                <Card className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <ArrowUp className="w-5 h-5 text-green-500" />
                        <h3 className="font-semibold text-foreground">Total Lent</h3>
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-1">
                        ${totalLent.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {activeLentCount} active loan{activeLentCount !== 1 ? 's' : ''}
                    </p>
                </Card>
            </div>

            {/* Loans Tabs */}
            <Tabs defaultValue="borrowed" className="w-full">
                <TabsList className="grid w-full md:w-auto grid-cols-2">
                    <TabsTrigger value="borrowed">
                        Borrowed ({borrowedLoans.length})
                    </TabsTrigger>
                    <TabsTrigger value="lent">
                        Lent ({lentLoans.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="borrowed" className="space-y-4 mt-6">
                    {borrowedLoans.length === 0 ? (
                        <EmptyState type="borrowed" />
                    ) : (
                        borrowedLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)
                    )}
                </TabsContent>

                <TabsContent value="lent" className="space-y-4 mt-6">
                    {lentLoans.length === 0 ? (
                        <EmptyState type="lent" />
                    ) : (
                        lentLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

