/**
 * JupiterPriceBanner — Live SOL/BONK/USDC prices from Jupiter Price API
 * Auto-refreshes every 15s. Used as a top bar inside the demo view.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getJupiterPrice } from '@/lib/solana';

interface TokenPrice {
  symbol: string;
  price: number;
  change?: number;   // % change (calculated vs previous)
  icon: string;
}

const TOKENS = [
  { symbol: 'SOL',  icon: '◎' },
  { symbol: 'BONK', icon: '🐕' },
];

export function JupiterPriceBanner() {
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [flash, setFlash] = useState(false);
  const prevPrices = React.useRef<Record<string, number>>({});

  const fetchPrices = useCallback(async () => {
    const results = await Promise.allSettled(
      TOKENS.map(t => getJupiterPrice(t.symbol).then(p => ({ ...t, price: p?.priceUsd ?? 0 })))
    );

    const newPrices: TokenPrice[] = results
      .filter((r): r is PromiseFulfilledResult<TokenPrice> => r.status === 'fulfilled')
      .map(r => {
        const prev = prevPrices.current[r.value.symbol];
        const change = prev ? ((r.value.price - prev) / prev) * 100 : 0;
        prevPrices.current[r.value.symbol] = r.value.price;
        return { ...r.value, change };
      });

    setPrices(newPrices);
    setLastUpdated(new Date());
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 15_000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  if (prices.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/60 border border-gray-700/50 text-xs text-gray-500">
        <span className="animate-pulse">⟳</span> Loading Jupiter prices...
      </div>
    );
  }

  return (
    <motion.div
      animate={flash ? { borderColor: 'rgba(168,85,247,0.5)' } : { borderColor: 'rgba(55,65,81,0.5)' }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-gray-900/60 border border-gray-700/50 overflow-hidden"
    >
      {/* Jupiter badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-cyan-400" />
        <span className="text-[10px] font-semibold text-gray-400">Jupiter</span>
      </div>

      <div className="w-px h-4 bg-gray-700" />

      {/* Prices */}
      <div className="flex items-center gap-5">
        {prices.map(token => (
          <div key={token.symbol} className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">{token.icon}</span>
            <span className="text-xs font-semibold text-white">
              {token.symbol === 'BONK'
                ? `$${token.price.toFixed(8)}`
                : `$${token.price.toFixed(2)}`}
            </span>
            {token.change !== undefined && Math.abs(token.change) > 0.001 && (
              <AnimatePresence mode="wait">
                <motion.span
                  key={token.change.toFixed(3)}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-[10px] font-medium ${
                    token.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {token.change >= 0 ? '+' : ''}{token.change.toFixed(2)}%
                </motion.span>
              </AnimatePresence>
            )}
          </div>
        ))}
      </div>

      {/* Refresh indicator */}
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-gray-600">
          {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
        </span>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="w-3 h-3 border border-gray-600 border-t-gray-400 rounded-full"
        />
      </div>
    </motion.div>
  );
}
