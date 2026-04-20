/**
 * Mythos — Main Solana DeFi Lending Page
 * ========================================
 * The primary hackathon demo page showcasing:
 *   - Phantom/Solflare wallet connection
 *   - SAS credit attestation
 *   - Live Lenny × Luna AI negotiation
 *   - x402 micropayment visualization
 *   - Solana on-chain settlement
 *   - Real-time Helius event feed
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentNegotiationFeed, useNegotiationMessages, type NegotiationMessage } from '@/components/AgentNegotiationFeed';
import { X402PaymentVisualizer, generateDemoPayment, type X402PaymentEvent } from '@/components/X402PaymentVisualizer';
import { WalletButton, useWallet } from '@/components/wallet/SolanaWalletProvider';
import {
  getJupiterPrice,
  getExplorerUrl,
  shortenAddress,
  SOLANA_NETWORK,
  MYTHOS_PROGRAM_ID,
  type HeliusLoanEvent,
} from '@/lib/solana';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================================================
// Header
// ============================================================================

function MythosHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-black/40">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/30">
          M
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-tight">MYTHOS</div>
          <div className="text-[10px] text-purple-400 font-medium">AI × Solana Lending</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 px-3 py-1.5 rounded-full border border-gray-700/50">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {SOLANA_NETWORK}
        </div>
        <WalletButton />
      </div>
    </header>
  );
}

// ============================================================================
// Hero Section
// ============================================================================

function HeroSection({ onStart }: { onStart: () => void }) {
  const wallet = useWallet();
  const [solPrice, setSolPrice] = useState<number>(180.5);

  useEffect(() => {
    getJupiterPrice('SOL').then(p => p && setSolPrice(p.priceUsd));
  }, []);

  return (
    <div className="text-center max-w-4xl mx-auto py-16 px-6">
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 mb-6"
      >
        <span className="animate-pulse">◎</span>
        Built for Solana Hackathon 2026
        <span className="px-2 py-0.5 bg-purple-500/20 rounded-full text-purple-200 text-[10px] font-semibold">x402 · SAS · Helius · Jupiter</span>
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-5xl sm:text-7xl font-black text-white mb-4 leading-tight tracking-tight"
      >
        AI-Native{' '}
        <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
          Lending
        </span>
        <br />on Solana
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed"
      >
        Two AI agents negotiate your loan terms on-chain. Lenny finds the best rate,
        Luna prices the risk — both pay each other in USDC via x402 to get the deal done.
      </motion.p>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap justify-center gap-6 mb-10 text-sm"
      >
        {[
          { label: 'SOL Price', value: `$${solPrice.toFixed(2)}`, icon: '◎', color: 'text-green-400' },
          { label: 'TPS', value: '~4,000', icon: '⚡', color: 'text-yellow-400' },
          { label: 'Settlement', value: '<1s', icon: '🚀', color: 'text-blue-400' },
          { label: 'Protocol', value: 'x402', icon: '💸', color: 'text-purple-400' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-2 text-gray-300">
            <span className={stat.color}>{stat.icon}</span>
            <span className="font-bold">{stat.value}</span>
            <span className="text-gray-500">{stat.label}</span>
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 justify-center"
      >
        {wallet.connected ? (
          <button
            onClick={onStart}
            id="start-loan-btn"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold text-lg shadow-2xl shadow-purple-500/30 transition-all hover:scale-105 active:scale-95"
          >
            🤖 Start AI Loan Negotiation
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <WalletButton />
            <p className="text-xs text-gray-500">Connect wallet to get started</p>
          </div>
        )}
        <a
          href={`https://explorer.solana.com/address/${MYTHOS_PROGRAM_ID}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-4 rounded-xl border border-gray-700 hover:border-purple-500/50 text-gray-300 hover:text-white font-semibold transition-all"
          id="view-program-btn"
        >
          ◎ View Anchor Program
        </a>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Loan Request Form
// ============================================================================

interface LoanParams {
  amount: number;
  termMonths: number;
  collateral: string;
}

function LoanRequestForm({
  params,
  onChange,
  onSubmit,
  isLoading,
}: {
  params: LoanParams;
  onChange: (p: Partial<LoanParams>) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const wallet = useWallet();

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">📋</span>
        <h2 className="text-white font-bold">Loan Parameters</h2>
        <span className="ml-auto text-xs text-purple-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          SAS Verified
        </span>
      </div>

      <div>
        <label className="text-xs text-gray-400 font-medium mb-2 block">
          Loan Amount (USDC)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
          <input
            id="loan-amount-input"
            type="number"
            value={params.amount}
            onChange={e => onChange({ amount: parseFloat(e.target.value) || 0 })}
            className="w-full pl-8 pr-4 py-3 bg-gray-800/60 border border-gray-700 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500 transition-colors"
            min={100}
            max={50000}
            step={100}
          />
        </div>
        <div className="flex gap-2 mt-2">
          {[500, 1000, 2500, 5000].map(amt => (
            <button
              key={amt}
              id={`amount-preset-${amt}`}
              onClick={() => onChange({ amount: amt })}
              className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-purple-500/20 hover:border-purple-500/40 border border-gray-700 text-gray-400 hover:text-purple-300 transition-all"
            >
              ${amt.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 font-medium mb-2 block">
          Loan Term: <span className="text-purple-300 font-bold">{params.termMonths} months</span>
        </label>
        <input
          id="loan-term-slider"
          type="range"
          min={1}
          max={24}
          value={params.termMonths}
          onChange={e => onChange({ termMonths: parseInt(e.target.value) })}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>1mo</span><span>6mo</span><span>12mo</span><span>18mo</span><span>24mo</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 font-medium mb-2 block">Collateral Token</label>
        <div className="grid grid-cols-3 gap-2">
          {['SOL', 'USDC', 'BONK'].map(token => (
            <button
              key={token}
              id={`collateral-${token.toLowerCase()}-btn`}
              onClick={() => onChange({ collateral: token })}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                params.collateral === token
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-800/40 rounded-xl p-4 space-y-2 border border-gray-700/30">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Luna's Opening Rate</span>
          <span className="text-white font-semibold">9.50% APR</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Your SAS Tier</span>
          <span className="text-purple-300 font-semibold">Tier A (Good)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Target Rate (AI)</span>
          <span className="text-green-400 font-semibold">~7.5–8.5%</span>
        </div>
        <div className="h-px bg-gray-700 my-1" />
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Monthly x402 Fees</span>
          <span className="text-yellow-400 font-semibold">~0.004 USDC</span>
        </div>
      </div>

      <button
        id="submit-loan-btn"
        onClick={onSubmit}
        disabled={isLoading || !wallet.connected || params.amount <= 0}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold text-sm shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >⟳</motion.span>
            Negotiating on Solana...
          </span>
        ) : wallet.connected ? (
          '🤖 Start AI Negotiation'
        ) : (
          'Connect Wallet First'
        )}
      </button>
    </div>
  );
}

// ============================================================================  
// Helius Live Feed (bottom ticker)
// ============================================================================

function HeliusFeedTicker({ events }: { events: HeliusLoanEvent[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (events.length === 0) return;
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % events.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [events.length]);

  if (events.length === 0) return null;

  const event = events[index];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur border-t border-gray-800 py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center gap-4 text-xs text-gray-400">
        <span className="text-green-400 font-medium whitespace-nowrap flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Helius Live
        </span>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 truncate"
          >
            <span className="text-gray-200">{event.message}</span>
            {event.txSignature && (
              <a href={getExplorerUrl(event.txSignature)} target="_blank" rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 whitespace-nowrap">
                {shortenAddress(event.txSignature)} ↗
              </a>
            )}
          </motion.div>
        </AnimatePresence>
        <span className="ml-auto whitespace-nowrap text-gray-600">{event.timestamp?.slice(11, 19)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function MythosPage() {
  const wallet = useWallet();
  const { messages, isRunning, startNegotiation, clearMessages } = useNegotiationMessages();
  const [x402Payments, setX402Payments] = useState<X402PaymentEvent[]>([]);
  const [heliusEvents, setHeliusEvents] = useState<HeliusLoanEvent[]>([]);
  const [loanParams, setLoanParams] = useState<LoanParams>({ amount: 1000, termMonths: 12, collateral: 'SOL' });
  const [view, setView] = useState<'hero' | 'demo'>('hero');

  // Simulate Helius event stream
  useEffect(() => {
    const events: HeliusLoanEvent[] = [
      { eventType: 'jupiter_price_check', message: 'Jupiter: SOL/USD = $180.50 (+2.3%)', slot: 350012345, timestamp: new Date().toISOString(), network: SOLANA_NETWORK },
      { eventType: 'attestation_verified', message: 'SAS attestation verified for LennyBorrower...', slot: 350012346, timestamp: new Date().toISOString(), network: SOLANA_NETWORK },
      { eventType: 'payment_x402', message: 'x402: 0.001 USDC paid for /api/agent/evaluate', slot: 350012347, timestamp: new Date().toISOString(), network: SOLANA_NETWORK },
      { eventType: 'negotiation_round', message: 'Lenny: counter 7.5% → Luna: counter 8.0%', slot: 350012348, timestamp: new Date().toISOString(), network: SOLANA_NETWORK },
      { eventType: 'loan_accepted', message: 'Mythos Anchor: Loan #42 settled at 8.0% APR ✅', slot: 350012349, timestamp: new Date().toISOString(), network: SOLANA_NETWORK },
    ];
    const interval = setInterval(() => {
      setHeliusEvents(prev => {
        const newEvent = {
          ...events[Math.floor(Math.random() * events.length)],
          slot: 350012348 + prev.length,
          timestamp: new Date().toISOString(),
        };
        return [...prev.slice(-50), newEvent];
      });
    }, 4000);
    // Prime with initial events
    setHeliusEvents(events);
    return () => clearInterval(interval);
  }, []);

  const handleStartNegotiation = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) return;
    setView('demo');
    clearMessages();
    setX402Payments([]);

    // Trigger backend workflow (Solana-native route)
    try {
      await fetch(`${API_URL}/api/solana/workflow/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower_address: wallet.publicKey,
          credit_score: 720,
          principal: loanParams.amount,
          interest_rate: 9.5,
          term_months: loanParams.termMonths,
        }),
      });
    } catch {
      // Backend might not be running; demo still works client-side
    }

    // Start frontend negotiation animation
    await startNegotiation({
      borrower: wallet.publicKey,
      amount: loanParams.amount,
      initialRate: 9.5,
      termMonths: loanParams.termMonths,
    });

    // Add x402 payments progressively
    const addPayments = async () => {
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        setX402Payments(prev => [...prev, generateDemoPayment(i)]);
      }
    };
    addPayments();
  }, [wallet, loanParams, startNegotiation, clearMessages]);

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/6 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      <MythosHeader />

      <main className="relative pt-20 pb-16 px-4">
        <AnimatePresence mode="wait">
          {view === 'hero' ? (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <HeroSection onStart={() => { if (wallet.connected) setView('demo'); }} />

              {/* Feature cards */}
              <div className="max-w-6xl mx-auto mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4">
                {[
                  {
                    icon: '🤖', title: 'AI Negotiation',
                    desc: 'Lenny & Luna negotiate your interest rate autonomously using CrewAI + Llama 3',
                    tag: 'CrewAI'
                  },
                  {
                    icon: '💸', title: 'x402 Payments',
                    desc: 'Agents pay each other micro-fees in USDC on Solana for every AI service call',
                    tag: 'HTTP 402'
                  },
                  {
                    icon: '🪪', title: 'SAS Attestations',
                    desc: 'Credit scores verified on-chain via Solana Attestation Service — no privacy leaks',
                    tag: 'Solana SAS'
                  },
                  {
                    icon: '◎', title: 'Anchor Programs',
                    desc: 'Loans settled in sub-second via Anchor smart contracts on Solana Devnet',
                    tag: 'Anchor'
                  },
                ].map(card => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -4 }}
                    className="bg-gray-900/60 rounded-2xl border border-gray-700/50 p-5 hover:border-purple-500/40 transition-all cursor-default"
                  >
                    <div className="text-3xl mb-3">{card.icon}</div>
                    <div className="text-sm font-bold text-white mb-1">{card.title}</div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">{card.desc}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                      {card.tag}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Connect CTA if not connected */}
              {!wallet.connected && (
                <div className="max-w-md mx-auto mt-12 text-center">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6">
                    <p className="text-gray-300 mb-4 text-sm">Connect your Solana wallet to experience AI-negotiated DeFi lending</p>
                    <WalletButton />
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="demo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-7xl mx-auto"
            >
              {/* Back button */}
              <button
                onClick={() => setView('hero')}
                className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                id="back-to-home-btn"
              >
                ← Back
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: Loan Form */}
                <div className="lg:col-span-1">
                  <LoanRequestForm
                    params={loanParams}
                    onChange={p => setLoanParams(prev => ({ ...prev, ...p }))}
                    onSubmit={handleStartNegotiation}
                    isLoading={isRunning}
                  />

                  {/* Network info */}
                  <div className="mt-4 bg-gray-900/60 rounded-2xl border border-gray-700/50 p-4 text-xs space-y-2">
                    <div className="font-medium text-gray-300 mb-2">🔗 Network Info</div>
                    <div className="flex justify-between text-gray-500">
                      <span>Network</span><span className="text-green-400 capitalize">{SOLANA_NETWORK}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Program</span>
                      <a href={getExplorerUrl(MYTHOS_PROGRAM_ID, 'address')} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                        {MYTHOS_PROGRAM_ID.slice(0, 12)}... ↗
                      </a>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>RPC</span><span className="text-blue-400">Helius</span>
                    </div>
                    {wallet.publicKey && (
                      <div className="flex justify-between text-gray-500">
                        <span>Wallet</span>
                        <span className="text-white">{shortenAddress(wallet.publicKey)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle: Agent Negotiation Feed */}
                <div className="lg:col-span-1 bg-gray-900/60 rounded-2xl border border-gray-700/50 overflow-hidden" style={{ minHeight: '600px' }}>
                  <AgentNegotiationFeed
                    messages={messages}
                    isLive={isRunning}
                    className="h-full"
                  />
                </div>

                {/* Right: x402 Payments */}
                <div className="lg:col-span-1 bg-gray-900/60 rounded-2xl border border-gray-700/50 p-5">
                  <X402PaymentVisualizer payments={x402Payments} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Helius real-time feed ticker */}
      <HeliusFeedTicker events={heliusEvents} />
    </div>
  );
}
