/**
 * Lendora AI - Settings Page
 * User settings and preferences
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@/hooks/useWallet';
import { Settings as SettingsIcon, Wallet, Bell, Globe, Shield } from 'lucide-react';
import { DisconnectWalletDialog } from '@/components/dashboard/DisconnectWalletDialog';

export default function Settings() {
    const { address, network } = useWallet();
    const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Wallet Settings */}
            <Card className="glass-card p-6 border-2 border-border/50">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Wallet</h2>
                </div>
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Connected Address</Label>
                        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm text-foreground break-all">{address || 'Not connected'}</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Network</Label>
                        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="text-sm font-medium text-foreground">{network || 'Not connected'}</p>
                        </div>
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={() => setShowDisconnectDialog(true)} 
                        className="w-full sm:w-auto"
                    >
                        Disconnect Wallet
                    </Button>
                </div>
            </Card>

            {/* Disconnect Wallet Dialog */}
            <DisconnectWalletDialog 
                open={showDisconnectDialog} 
                onOpenChange={setShowDisconnectDialog} 
            />

            {/* Notification Settings */}
            <Card className="glass-card p-6 border-2 border-border/50">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
                </div>
                <div className="space-y-5">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1">
                            <Label className="text-base font-medium text-foreground">Email Notifications</Label>
                            <p className="text-sm text-muted-foreground mt-1">Receive updates via email</p>
                        </div>
                        <Switch />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1">
                            <Label className="text-base font-medium text-foreground">Loan Alerts</Label>
                            <p className="text-sm text-muted-foreground mt-1">Get notified about loan status changes</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1">
                            <Label className="text-base font-medium text-foreground">Interest Rate Changes</Label>
                            <p className="text-sm text-muted-foreground mt-1">Alerts for market rate updates</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            </Card>

            {/* Preferences */}
            <Card className="glass-card p-6 border-2 border-border/50">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Preferences</h2>
                </div>
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Default Stablecoin</Label>
                        <Select defaultValue="USDC">
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="USDC">USDC</SelectItem>
                                <SelectItem value="USDT">USDT</SelectItem>
                                <SelectItem value="DAI">DAI</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Default Network</Label>
                        <Select defaultValue="devnet">
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="devnet">Solana Devnet</SelectItem>
                                <SelectItem value="mainnet-beta">Solana Mainnet</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Security */}
            <Card className="glass-card p-6 border-2 border-border/50">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Security</h2>
                </div>
                <div className="space-y-5">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1">
                            <Label className="text-base font-medium text-foreground">Two-Factor Authentication</Label>
                            <p className="text-sm text-muted-foreground mt-1">Add an extra layer of security</p>
                        </div>
                        <Switch />
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1">
                            <Label className="text-base font-medium text-foreground">Transaction Confirmations</Label>
                            <p className="text-sm text-muted-foreground mt-1">Require confirmation for all transactions</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            </Card>
        </div>
    );
}
