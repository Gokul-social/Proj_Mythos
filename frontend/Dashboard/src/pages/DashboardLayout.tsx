/**
 * Lendora AI - Create Loan Wizard
 * Simple 3-step wizard focused on loan creation
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WalletConnectionWizard } from '@/components/dashboard/WalletConnectionWizard';
import { LoanConfigurationForm } from '@/components/dashboard/LoanConfigurationForm';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { CheckCircle2, Wallet, Settings, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLendora } from '@/context/LendoraContext';
import { toast } from '@/components/ui/sonner';

type Role = 'borrower' | 'lender' | null;
type Step = 1 | 2 | 3;

interface LoanFormData {
    role: Role;
    walletAddress: string;
    principal: number;
    interestRate: number;
    termMonths: number;
    creditScore: number;
    lenderAddress: string;
    borrowerAddress: string;
    stablecoin: string;
    autoConfirm: boolean;
}

export default function DashboardLayout() {
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [role, setRole] = useState<Role>(null);
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [formData, setFormData] = useState<Partial<LoanFormData>>({});
    const { addLoan } = useLendora();

    const handleRoleSelect = (selectedRole: Role) => {
        setRole(selectedRole);
        setFormData(prev => ({ ...prev, role: selectedRole }));
        setCurrentStep(2);
    };

    const handleWalletConnected = (address: string) => {
        setWalletAddress(address);
        setFormData(prev => ({ ...prev, walletAddress: address }));
        setCurrentStep(3);
    };

    const handleBack = () => {
        if (currentStep === 3) {
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(1);
        }
    };

    const handleLoanSubmit = async (data: Partial<LoanFormData>) => {
        const finalData = {
            ...formData,
            ...data,
            role: role!,
            walletAddress,
        };

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/workflow/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role: finalData.role,
                    borrower_address: finalData.role === 'borrower' ? finalData.walletAddress : finalData.borrowerAddress || '',
                    lender_address: finalData.role === 'lender' ? finalData.walletAddress : finalData.lenderAddress || '',
                    credit_score: finalData.creditScore || 750,
                    principal: finalData.principal,
                    interest_rate: finalData.interestRate,
                    term_months: finalData.termMonths,
                    stablecoin: finalData.stablecoin || 'USDT',
                    auto_confirm: finalData.autoConfirm || false,
                }),
            });

            const result = await response.json();
            if (result.success) {
                // Add loan to global state
                const loanType = finalData.role === 'borrower' ? 'borrow' : 'lend';
                const newLoan = addLoan({
                    asset: finalData.stablecoin || 'USDT',
                    amount: finalData.principal || 0,
                    type: loanType,
                    apy: finalData.interestRate || 8.5,
                    status: 'active',
                    termMonths: finalData.termMonths || 12,
                    walletAddress: finalData.walletAddress || '',
                    counterpartyAddress: loanType === 'borrow' 
                        ? finalData.lenderAddress 
                        : finalData.borrowerAddress,
                });

                // Show success toast
                toast.success('Loan Created Successfully!', {
                    description: `Your ${loanType === 'borrow' ? 'borrowed' : 'lent'} loan of ${finalData.principal?.toLocaleString()} ${finalData.stablecoin || 'USDT'} has been created.`,
                    duration: 5000,
                });

                // Reset wizard after successful submission
                setTimeout(() => {
                    setCurrentStep(1);
                    setRole(null);
                    setWalletAddress('');
                    setFormData({});
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to submit loan:', err);
            
            // Even if API fails, add loan to local state for demo purposes
            const loanType = finalData.role === 'borrower' ? 'borrow' : 'lend';
            addLoan({
                asset: finalData.stablecoin || 'USDT',
                amount: finalData.principal || 0,
                type: loanType,
                apy: finalData.interestRate || 8.5,
                status: 'active',
                termMonths: finalData.termMonths || 12,
                walletAddress: finalData.walletAddress || '',
                counterpartyAddress: loanType === 'borrow' 
                    ? finalData.lenderAddress 
                    : finalData.borrowerAddress,
            });

            // Show success toast (since we still added to local state)
            toast.success('Loan Created Locally', {
                description: `Your ${loanType === 'borrow' ? 'borrowed' : 'lent'} loan of ${finalData.principal?.toLocaleString()} ${finalData.stablecoin || 'USDT'} has been saved.`,
                duration: 5000,
            });

            // Reset wizard
            setTimeout(() => {
                setCurrentStep(1);
                setRole(null);
                setWalletAddress('');
                setFormData({});
            }, 2000);
        }
    };

    return (
        <div className="w-full space-y-8">
            {/* Dashboard Stats */}
            <div className="w-full">
                <DashboardStats />
            </div>

            {/* Loan Creation Wizard */}
            <div className="w-full flex items-center justify-center">
                <div className="w-full max-w-2xl mx-auto">
                    {/* Step Indicator */}
                <div className="flex items-center justify-center mb-8 gap-4">
                    <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            currentStep >= 1 
                                ? 'bg-primary border-primary text-primary-foreground' 
                                : 'border-border'
                        }`}>
                            {currentStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                        </div>
                        <span className="text-sm font-medium">Role</span>
                    </div>
                    <div className={`w-12 h-0.5 ${currentStep >= 2 ? 'bg-primary' : 'bg-border'}`} />
                    <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            currentStep >= 2 
                                ? 'bg-primary border-primary text-primary-foreground' 
                                : 'border-border'
                        }`}>
                            {currentStep > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                        </div>
                        <span className="text-sm font-medium">Wallet</span>
                    </div>
                    <div className={`w-12 h-0.5 ${currentStep >= 3 ? 'bg-primary' : 'bg-border'}`} />
                    <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            currentStep >= 3 
                                ? 'bg-primary border-primary text-primary-foreground' 
                                : 'border-border'
                        }`}>
                            3
                        </div>
                        <span className="text-sm font-medium">Configure</span>
                    </div>
                </div>

                {/* Wizard Content */}
                <Card className="p-8">
                    {/* Step 1: Choose Role */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h1 className="text-2xl font-semibold mb-2 text-foreground">Create Loan</h1>
                                <p className="text-muted-foreground">Choose your role to get started</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleRoleSelect('borrower')}
                                    className="p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 text-left transition-colors"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Wallet className="w-5 h-5 text-primary" />
                                        </div>
                                        <h3 className="font-semibold text-foreground">Borrower</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Request a loan and negotiate terms
                                    </p>
                                </button>
                                <button
                                    onClick={() => handleRoleSelect('lender')}
                                    className="p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 text-left transition-colors"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Settings className="w-5 h-5 text-primary" />
                                        </div>
                                        <h3 className="font-semibold text-foreground">Lender</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Provide funds and set loan parameters
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Connect Wallet */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold mb-1 text-foreground">Connect Wallet</h2>
                                    <p className="text-sm text-muted-foreground">Connect your Solana wallet (Phantom) to continue</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </div>
                            <WalletConnectionWizard
                                onConnect={handleWalletConnected}
                                role={role}
                            />
                        </div>
                    )}

                    {/* Step 3: Configure Loan */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold mb-1 text-foreground">Configure Loan</h2>
                                    <p className="text-sm text-muted-foreground">Set your loan parameters</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </div>
                            <LoanConfigurationForm
                                role={role!}
                                walletAddress={walletAddress}
                                onSubmit={handleLoanSubmit}
                            />
                        </div>
                    )}
                </Card>
                </div>
            </div>
        </div>
    );
}

