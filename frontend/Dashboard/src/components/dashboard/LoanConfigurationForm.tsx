/**
 * Simplified Loan Configuration Form
 * Clean, minimal form for loan parameters
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    DollarSign, 
    Percent, 
    Calendar, 
    Wallet,
    Loader2,
    CheckCircle2
} from 'lucide-react';

interface LoanFormData {
    role: 'borrower' | 'lender';
    walletAddress: string;
    principal: number;
    interestRate: number;
    termMonths: number;
    creditScore: number;
    stablecoin: string;
    autoConfirm: boolean;
    lenderAddress?: string;
    borrowerAddress?: string;
}

interface LoanConfigurationFormProps {
    role: 'borrower' | 'lender';
    walletAddress: string;
    onSubmit: (data: LoanFormData) => void;
}

export function LoanConfigurationForm({ role, walletAddress, onSubmit }: LoanConfigurationFormProps) {
    const [principal, setPrincipal] = useState<number>(1000);
    const [interestRate, setInterestRate] = useState<number>(8.5);
    const [termMonths, setTermMonths] = useState<number>(12);
    const [creditScore, setCreditScore] = useState<number>(750);
    const [counterpartyAddress, setCounterpartyAddress] = useState<string>('');
    const [stablecoin, setStablecoin] = useState<string>('USDT');
    const [autoConfirm, setAutoConfirm] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [success, setSuccess] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSuccess(false);

        const formData = {
            role,
            walletAddress,
            principal,
            interestRate,
            termMonths,
            creditScore,
            stablecoin,
            autoConfirm,
            ...(role === 'borrower' 
                ? { lenderAddress: counterpartyAddress }
                : { borrowerAddress: counterpartyAddress }
            ),
        };

        try {
            await onSubmit(formData);
            setSuccess(true);
            setTimeout(() => {
                setIsSubmitting(false);
            }, 2000);
        } catch (err) {
            console.error('Submission error:', err);
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Principal Amount */}
            <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Principal Amount ({stablecoin})
                </Label>
                <Input
                    type="number"
                    min="100"
                    step="100"
                    value={principal}
                    onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
                    required
                />
                <p className="text-xs text-muted-foreground">Minimum: 100 {stablecoin}</p>
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Interest Rate (%)
                </Label>
                <Input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                    required
                />
                <p className="text-xs text-muted-foreground">Initial interest rate for negotiation</p>
            </div>

            {/* Term */}
            <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Loan Term (Months)
                </Label>
                <Input
                    type="number"
                    min="1"
                    max="60"
                    value={termMonths}
                    onChange={(e) => setTermMonths(parseInt(e.target.value) || 1)}
                    required
                />
                <p className="text-xs text-muted-foreground">Loan duration in months</p>
            </div>

            {/* Credit Score */}
            <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Credit Score
                </Label>
                <Input
                    type="number"
                    min="600"
                    max="850"
                    value={creditScore}
                    onChange={(e) => setCreditScore(parseInt(e.target.value) || 700)}
                    required
                />
                <p className="text-xs text-muted-foreground">Your credit score (private via ZK proofs)</p>
            </div>

            {/* Counterparty Address */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">
                    {role === 'borrower' ? 'Lender Address' : 'Borrower Address'}
                </Label>
                <Input
                    type="text"
                    value={counterpartyAddress}
                    onChange={(e) => setCounterpartyAddress(e.target.value)}
                    placeholder="0x..."
                    className="font-mono text-sm"
                    required
                />
                <p className="text-xs text-muted-foreground">
                    Solana address of the {role === 'borrower' ? 'lender' : 'borrower'}
                </p>
            </div>

            {/* Stablecoin Selection */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">Stablecoin</Label>
                <select
                    value={stablecoin}
                    onChange={(e) => setStablecoin(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                    <option value="DAI">DAI</option>
                </select>
            </div>

            {/* Auto-Confirm Toggle */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
                <input
                    type="checkbox"
                    id="autoConfirm"
                    checked={autoConfirm}
                    onChange={(e) => setAutoConfirm(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                />
                <Label htmlFor="autoConfirm" className="text-sm cursor-pointer">
                    Auto-confirm favorable terms
                </Label>
            </div>

            {/* Submit Button */}
            <Button
                type="submit"
                disabled={isSubmitting || success}
                className="w-full"
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Loan...
                    </>
                ) : success ? (
                    <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Loan Created
                    </>
                ) : (
                    'Create Loan'
                )}
            </Button>
        </form>
    );
}

