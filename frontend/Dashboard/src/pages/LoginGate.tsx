/**
 * Lendora AI - Login Gate
 * Portal entrance with HeroCube and wallet connection
 */

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/Logo';
import { PixelatedParticleField } from '@/components/3d/PixelatedParticleField';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, ExternalLink, AlertCircle, Loader2, Sun, Moon } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useTheme } from 'next-themes';
import type { WalletName } from '@/lib/wallet/ethereum-wallet';

const ANIMATION_DURATION = 1500;

export default function LoginGate() {
    const [isAnimating, setIsAnimating] = useState(false);
    const [showWalletList, setShowWalletList] = useState(false);
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();

    const {
        installedWallets,
        isConnecting,
        isConnected,
        error,
        shortAddress,
        balance,
        network,
        connect,
        disconnect,
    } = useWallet();

    const handleWalletSelect = async (walletName: WalletName) => {
        try {
            await connect(walletName);
            setShowWalletList(false);

            // Animate and navigate after successful connection
            setIsAnimating(true);
            setTimeout(() => {
                navigate('/dashboard');
            }, ANIMATION_DURATION);
        } catch {
            // Error is handled by the hook
        }
    };

    const handleDemoMode = () => {
        setIsAnimating(true);
        setTimeout(() => {
            navigate('/dashboard');
        }, ANIMATION_DURATION);
    };

    const installedCount = installedWallets.filter(w => w.installed).length;

    // Wallet icons mapping
    const walletIcons: Record<string, string> = {
        phantom: '👻',
        coinbase: 'ðŸ”µ',
        walletconnect: 'ðŸ”—',
        trust: 'ðŸ›¡ï¸',
        rainbow: 'ðŸŒˆ',
    };

    return (
        <div className="relative w-full h-screen overflow-hidden space-bg transition-colors duration-500">
            {/* Theme Toggle */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="absolute top-4 right-4 z-50"
            >
                <Button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    variant="outline"
                    size="icon"
                    className="backdrop-blur-xl bg-card/50 border-2 border-primary/30 pixel-glow"
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
            </motion.div>

            {/* 3D Background Canvas */}
            <div className="absolute inset-0">
                <Canvas
                    camera={{ position: [0, 0, 8], fov: 50 }}
                    dpr={[1, 2]}
                    performance={{ min: 0.5 }}
                >
                    <PixelatedParticleField count={typeof window !== 'undefined' && window.innerWidth < 768 ? 2000 : 5000} />
                </Canvas>
            </div>

            {/* UI Overlay */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full pointer-events-none px-4">
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-center mb-6 md:mb-8 pointer-events-auto"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ 
                            scale: 1, 
                            opacity: 1,
                            y: [0, -10, 0]
                        }}
                        transition={{ 
                            scale: { duration: 0.6, delay: 0.4, ease: "easeOut" },
                            opacity: { duration: 0.6, delay: 0.4 },
                            y: { 
                                duration: 4, 
                                repeat: Infinity, 
                                ease: "easeInOut",
                                delay: 0.8
                            }
                        }}
                        className="flex justify-center mb-4"
                    >
                        <Logo size="xl" showText={true} />
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3 tracking-tight"
                        style={{ 
                            textShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
                            filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.3))'
                        }}
                    >
                        AI-Powered Lending
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="text-sm md:text-lg text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed"
                    >
                        AI-Native Agentic Lending on Solana
                    </motion.p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="pointer-events-auto w-full max-w-md"
                >
                    <Card className="p-6 md:p-8 backdrop-blur-2xl bg-card/95 border-2 border-primary/30 shadow-[0_0_20px_rgba(168,85,247,0.4)] pixel-glow relative overflow-visible">
                        <div className="absolute inset-0 pixel-shimmer pointer-events-none overflow-hidden rounded-lg" />
                        <div className="relative z-10 flex flex-col gap-4">
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1, duration: 0.5 }}
                                className="text-center"
                            >
                                <motion.div
                                    className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 rounded-lg hero-gradient flex items-center justify-center pixel-border border-primary/40"
                                    animate={{ 
                                        scale: [1, 1.05, 1],
                                        rotate: [0, 5, -5, 0]
                                    }}
                                    transition={{ 
                                        duration: 3, 
                                        repeat: Infinity, 
                                        ease: "easeInOut" 
                                    }}
                                >
                                    <Wallet className="w-8 md:w-10 h-8 md:h-10 text-primary" />
                                </motion.div>
                                <motion.h2
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1, duration: 0.5 }}
                                    className="text-2xl md:text-3xl font-bold text-gradient mb-3"
                                >
                                    {isConnected ? 'âœ¨ Connected!' : 'Connect Wallet'}
                                </motion.h2>
                                {isConnected ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.1, duration: 0.5 }}
                                        className="space-y-2"
                                    >
                                        <p className="text-sm font-mono text-foreground font-semibold tracking-wider">
                                            {shortAddress}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {balance} ETH â€¢ {network}
                                        </p>
                                    </motion.div>
                                ) : (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1.1, duration: 0.5 }}
                                        className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed"
                                    >
                                        Connect your Solana wallet (Phantom) to access AI-native agentic lending
                                    </motion.p>
                                )}
                            </motion.div>

                            {/* Error Message */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0, y: -10 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive/30 flex items-start gap-3 pixel-border"
                                    >
                                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-destructive font-medium">{error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2, duration: 0.5 }}
                                className="flex flex-col gap-3"
                            >
                            {isConnected ? (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.2, duration: 0.5 }}
                                    >
                                        <Button
                                            onClick={handleDemoMode}
                                            size="lg"
                                            className="w-full gradient-glow text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 pixel-border border-primary/40"
                                            disabled={isAnimating}
                                        >
                                            {isAnimating ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Entering Portal...
                                                </>
                                            ) : (
                                                'Enter Dashboard â†’'
                                            )}
                                        </Button>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.3, duration: 0.5 }}
                                    >
                                        <Button
                                            onClick={disconnect}
                                            variant="outline"
                                            size="lg"
                                            className="w-full border-2 hover:bg-destructive/10 hover:border-destructive/30 transition-all duration-300"
                                        >
                                            Disconnect Wallet
                                        </Button>
                                    </motion.div>
                                </>
                            ) : (
                                <>
                                    {installedCount > 0 ? (
                                        <>
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 1.2, duration: 0.5 }}
                                            >
                                                <Button
                                                    onClick={() => setShowWalletList(!showWalletList)}
                                                    size="lg"
                                                    className="w-full glass-button button-shimmer text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group relative"
                                                    disabled={isConnecting}
                                                >
                                                    {isConnecting ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                            Connecting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wallet className="mr-2 h-5 w-5" />
                                                            Select Wallet ({installedCount} found)
                                                            <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-300 ${showWalletList ? 'rotate-180' : ''}`} />
                                                        </>
                                                    )}
                                                </Button>
                                            </motion.div>

                                            <AnimatePresence>
                                                {showWalletList && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0, y: -10 }}
                                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                                        exit={{ opacity: 0, height: 0, y: -10 }}
                                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                                        className="space-y-2 pt-2 max-h-64 overflow-y-auto"
                                                    >
                                                        {installedWallets
                                                            .filter(w => w.installed)
                                                            .map((wallet, index) => (
                                                                <motion.button
                                                                    key={wallet.name}
                                                                    onClick={() => handleWalletSelect(wallet.name as WalletName)}
                                                                    className="wallet-card w-full flex items-center justify-between text-left p-4 rounded-lg border-2 border-primary/20 hover:border-primary/40 transition-all duration-300"
                                                                    initial={{ opacity: 0, x: -20 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: index * 0.1, duration: 0.3 }}
                                                                    whileHover={{ scale: 1.02, x: 5 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl pixel-border border-primary/20">
                                                                            {walletIcons[wallet.name] || 'ðŸ’³'}
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <p className="font-semibold text-foreground">{wallet.displayName}</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {wallet.name === 'phantom' ? 'Recommended' : 'Solana Wallet'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                                                </motion.button>
                                                            ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 1.2, duration: 0.5 }}
                                            className="text-center p-6 bg-muted/50 rounded-lg border-2 border-muted/30 pixel-border"
                                        >
                                            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground mb-4">
                                                No Solana wallets detected. Install Phantom to continue.
                                            </p>
                                            <a
                                                href="https://phantom.app/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-primary hover:underline inline-flex items-center gap-1 font-medium"
                                            >
                                                Get Phantom
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </motion.div>
                                    )}

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.3, duration: 0.5 }}
                                        className="relative my-2"
                                    >
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t-2 border-border/50" />
                                        </div>
                                        <div className="relative flex justify-center text-xs">
                                            <span className="bg-card px-3 text-muted-foreground font-medium">or</span>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.4, duration: 0.5 }}
                                    >
                                        <Button
                                            onClick={handleDemoMode}
                                            variant="ghost"
                                            className="w-full glass-button text-muted-foreground hover:text-foreground transition-all duration-300"
                                        >
                                            Continue in Demo Mode
                                        </Button>
                                    </motion.div>
                                </>
                            )}
                            </motion.div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}



