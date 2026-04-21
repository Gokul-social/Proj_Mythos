/**
 * Mythos — Agent Negotiation Live Feed
 * ======================================
 * Real-time display of Lenny × Luna AI negotiation dialogue.
 * Streams negotiation messages via WebSocket from the backend,
 * and visualizes x402 micropayments as animated flows between agents.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getExplorerUrl, shortenAddress, bpsToPercent } from '@/lib/solana';

// ============================================================================
// Types
// ============================================================================

export interface NegotiationMessage {
  id: string;
  timestamp: string;
  agent: 'lenny' | 'luna' | 'system' | 'x402' | 'solana';
  type: 'message' | 'offer' | 'counter' | 'accept' | 'payment' | 'tx' | 'attestation';
  content: string;
  rate?: number;
  metadata?: Record<string, unknown>;
}

interface AgentNegotiationFeedProps {
  messages: NegotiationMessage[];
  isLive?: boolean;
  onNewMessage?: (msg: NegotiationMessage) => void;
  className?: string;
}

// ============================================================================
// Agent Avatar
// ============================================================================

function AgentAvatar({ agent }: { agent: NegotiationMessage['agent'] }) {
  const config = {
    lenny: { emoji: '🤖', color: 'from-violet-500 to-purple-600', label: 'Lenny' },
    luna: { emoji: '🌙', color: 'from-blue-500 to-cyan-500', label: 'Luna' },
    system: { emoji: '⚡', color: 'from-gray-600 to-gray-700', label: 'System' },
    x402: { emoji: '💸', color: 'from-yellow-500 to-amber-500', label: 'x402' },
    solana: { emoji: '◎', color: 'from-green-500 to-emerald-500', label: 'Solana' },
  };
  const cfg = config[agent] || config.system;
  
  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${cfg.color} flex items-center justify-center text-sm flex-shrink-0 shadow-lg`}>
      {cfg.emoji}
    </div>
  );
}

// ============================================================================
// Message Bubble
// ============================================================================

function MessageBubble({ msg }: { msg: NegotiationMessage }) {
  const isLenny = msg.agent === 'lenny';
  const isX402 = msg.agent === 'x402';
  const isSolana = msg.agent === 'solana';

  const bubbleColors = {
    lenny: 'bg-violet-500/15 border-violet-500/30 text-violet-100',
    luna: 'bg-blue-500/15 border-blue-500/30 text-blue-100',
    system: 'bg-gray-700/50 border-gray-600/30 text-gray-300',
    x402: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-100',
    solana: 'bg-green-500/15 border-green-500/30 text-green-100',
  };

  const typeIcon = {
    message: '',
    offer: '📋',
    counter: '⚡',
    accept: '✅',
    payment: '💸',
    tx: '🔗',
    attestation: '🪪',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isLenny ? 'flex-row' : msg.agent === 'luna' ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <AgentAvatar agent={msg.agent} />
      <div className={`flex-1 max-w-[80%] ${msg.agent === 'luna' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium capitalize">{msg.agent}</span>
          <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
          {msg.type !== 'message' && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-mono border ${bubbleColors[msg.agent]} opacity-75`}>
              {typeIcon[msg.type]} {msg.type}
            </span>
          )}
        </div>
        <div className={`px-3 py-2.5 rounded-xl border text-sm leading-relaxed ${bubbleColors[msg.agent] || bubbleColors.system}`}>
          {msg.content}
          {msg.rate !== undefined && (
            <div className="mt-1 text-lg font-bold tracking-tight">
              {msg.rate.toFixed(2)}% APR
            </div>
          )}
          {msg.metadata?.txSignature && (
            <a
              href={getExplorerUrl(String(msg.metadata.txSignature))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              🔗 {shortenAddress(String(msg.metadata.txSignature), 8)} ↗
            </a>
          )}
          {msg.metadata?.attestationId && (
            <div className="mt-1 font-mono text-xs opacity-70">
              SAS: {String(msg.metadata.attestationId).slice(0, 20)}...
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Rate Meter
// ============================================================================

function RateMeter({ currentRate, initialRate, finalRate }: {
  currentRate: number;
  initialRate: number;
  finalRate?: number;
}) {
  const savings = initialRate - currentRate;
  const progress = Math.min(100, Math.max(0, (savings / initialRate) * 100));

  return (
    <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">NEGOTIATION PROGRESS</span>
        {finalRate && (
          <span className="text-xs text-green-400 font-semibold">SETTLED ✅</span>
        )}
      </div>
      <div className="flex items-end gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Initial Rate</div>
          <div className="text-xl font-bold text-red-400">{initialRate.toFixed(1)}%</div>
        </div>
        <div className="flex-1 pb-1">
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="text-center text-xs text-green-400 mt-1">
            Saved {savings.toFixed(2)}% APR
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Current Rate</div>
          <div className="text-xl font-bold text-green-400">{currentRate.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentNegotiationFeed({
  messages,
  isLive = false,
  className = '',
}: AgentNegotiationFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Find rate progression
  const rateMessages = messages.filter(m => m.rate !== undefined);
  const initialRate = rateMessages[0]?.rate || 9.5;
  const currentRate = rateMessages[rateMessages.length - 1]?.rate || initialRate;
  const isSettled = messages.some(m => m.type === 'accept');
  const finalRate = isSettled ? currentRate : undefined;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <AgentAvatar agent="lenny" />
            <AgentAvatar agent="luna" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Lenny × Luna</div>
            <div className="text-xs text-gray-400">AI Agent Negotiation</div>
          </div>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* Rate Meter */}
      {rateMessages.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-700/50">
          <RateMeter
            currentRate={currentRate}
            initialRate={initialRate}
            finalRate={finalRate}
          />
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          setAutoScroll(atBottom);
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-sm">
            <span className="text-3xl mb-2">🤖</span>
            <p>Waiting for agent negotiation to start...</p>
            <p className="text-xs mt-1">Connect wallet and request a loan to begin</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>
        )}
        
        {isLive && messages.length > 0 && !isSettled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-gray-500 text-xs pl-11"
          >
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            Luna is typing...
          </motion.div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
        <span>{messages.length} messages</span>
        <span>{rateMessages.length} negotiation rounds</span>
        <span className="text-yellow-500">
          {messages.filter(m => m.agent === 'x402').length} x402 payments 💸
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for generating mock negotiation messages
// ============================================================================

export function useNegotiationMessages() {
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const startNegotiation = async (params: {
    borrower: string;
    amount: number;
    initialRate?: number;
    termMonths?: number;
  }) => {
    setIsRunning(true);
    setMessages([]);

    const { borrower, amount, initialRate = 9.5, termMonths = 12 } = params;
    const addMsg = (msg: Omit<NegotiationMessage, 'id' | 'timestamp'>) => {
      setMessages(prev => [...prev, {
        ...msg,
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
      }]);
    };

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Script
    await delay(300);
    addMsg({ agent: 'system', type: 'message', content: `🚀 Starting Mythos AI Loan Negotiation on Solana ${import.meta.env.VITE_SOLANA_NETWORK || 'devnet'}` });

    await delay(800);
    addMsg({ agent: 'lenny', type: 'attestation', content: `Checking SAS credit attestation for ${borrower.slice(0, 12)}...`, metadata: { step: 1 } });

    await delay(1200);
    addMsg({ agent: 'solana', type: 'attestation', content: `✅ SAS attestation verified! Tier A — max $50,000 USDC · LTV 130%`, metadata: { attestationId: 'att_demo_12345678', step: 1 } });

    await delay(900);
    addMsg({ agent: 'x402', type: 'payment', content: `💸 Lenny paid 0.001 USDC to call Luna's evaluation API (x402)`, metadata: { amount: 0.001, resource: '/api/agent/evaluate' } });

    await delay(800);
    addMsg({ agent: 'luna', type: 'offer', content: `I've reviewed your SAS attestation (Tier A). Based on market conditions, I'm offering:`, rate: initialRate, metadata: { principal: amount, termMonths } });

    await delay(1100);
    addMsg({ agent: 'lenny', type: 'message', content: `I've analyzed the offer. Market average is 7.8% APR — this is above fair value. I'll counter.` });

    await delay(600);
    addMsg({ agent: 'x402', type: 'payment', content: `💸 Lenny paid 0.0005 USDC to submit counter-offer (x402)` });

    await delay(900);
    const lennyCounter = parseFloat((initialRate - 2.0).toFixed(1));
    addMsg({ agent: 'lenny', type: 'counter', content: `Counter-offer: My SAS Tier A attestation and current market data justify a lower rate.`, rate: lennyCounter });

    await delay(1400);
    const lunaCounter = parseFloat(((initialRate + lennyCounter) / 2).toFixed(1));
    addMsg({ agent: 'luna', type: 'counter', content: `Fair point. I'll meet you halfway — my floor rate for Tier A is 7.0%. Let's do:`, rate: lunaCounter });

    await delay(800);
    addMsg({ agent: 'lenny', type: 'accept', content: `Agreed! ${lunaCounter}% is within my target range. Finalizing on-chain...`, rate: lunaCounter });

    await delay(700);
    addMsg({ agent: 'x402', type: 'payment', content: `💸 Lenny paid 0.002 USDC for Anchor transaction signing (x402)` });

    await delay(1100);
    const REAL_PROGRAM_ID = 'FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM';
    const mockTx = `5vKn2xQjR7pL9mD3sF8tY1wE4cA6bN0hG2kJ5oP${Date.now().toString(36).toUpperCase()}`;
    addMsg({
      agent: 'solana',
      type: 'tx',
      content: `✅ Loan settled on Solana Devnet! $${amount.toLocaleString()} USDC at ${lunaCounter}% APR for ${termMonths} months.`,
      rate: lunaCounter,
      metadata: {
        txSignature: mockTx,
        explorerUrl: `https://explorer.solana.com/tx/${mockTx}?cluster=devnet`,
        programId: REAL_PROGRAM_ID,
        savings: (initialRate - lunaCounter).toFixed(2),
      }
    });

    await delay(500);
    addMsg({ agent: 'system', type: 'message', content: `🎉 Mythos workflow complete! Saved ${(initialRate - lunaCounter).toFixed(1)}% APR through AI negotiation.` });

    setIsRunning(false);
  };

  return { messages, isRunning, startNegotiation, clearMessages: () => setMessages([]) };
}
