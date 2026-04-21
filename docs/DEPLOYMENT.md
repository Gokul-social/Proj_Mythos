# Mythos - Deployment Guide (Legacy Docker Reference)

> **This file is kept for reference. For the canonical deployment guide see [DEPLOY.md](../DEPLOY.md).**
> Mythos runs on **Solana Devnet** using **Vercel** (frontend) and **Railway** (backend).
> 100% Solana-native: Anchor program, Helius RPC, x402 micropayments, SAS attestations.

---

## Quick Deploy (Canonical - see DEPLOY.md)

| Layer | Platform | Command |
|---|---|---|
| Frontend | Vercel | Push to GitHub -> import in Vercel dashboard |
| Backend | Railway | `railway up` |
| Anchor Program | Solana Devnet | Already deployed (`9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr`) |

---

## Environment Variables

### Backend (Railway)

```env
HELIUS_API_KEY=your_helius_key
GROQ_API_KEY=your_groq_key
SOLANA_NETWORK=devnet
MYTHOS_PROGRAM_ID=9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
SOLANA_DEMO_MODE=true
PORT=8000
```

### Frontend (Vercel)

```env
VITE_API_URL=https://your-railway-url.up.railway.app
VITE_SOLANA_NETWORK=devnet
VITE_HELIUS_API_KEY=your_helius_key
VITE_MYTHOS_PROGRAM_ID=9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr
VITE_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

---

## Health Check

```bash
curl https://your-railway-url.up.railway.app/health
# -> {"status":"ok","network":"devnet","program_id":"FGG8363..."}
```

---

## Anchor Program

Program ID: `9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr`
Explorer: https://explorer.solana.com/address/9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr?cluster=devnet

