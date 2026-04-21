<div align="center">

# ◎ MYTHOS

### AI-Native Agentic Lending Protocol on Solana

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF.svg)](https://solana.com/)
[![Anchor](https://img.shields.io/badge/Anchor-1.0.0-blue.svg)](https://anchor-lang.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org/)
[![Built for Solana Hackathon 2026](https://img.shields.io/badge/Solana%20Hackathon-2026-9945FF)](https://colosseum.org/)

<p align="center">
  <strong>Two AI agents. One loan. Fully on-chain.</strong><br/>
  Lenny &amp; Luna negotiate your interest rate autonomously, pay each other in USDC via x402, and settle on Solana Devnet — no humans required.
</p>

[Quick Start](#-quick-start) •
[Architecture](#-architecture) •
[Live Deployment](#-live-deployment--solana-devnet) •
[API Docs](#-api-reference)

</div>

---

## 🎮 Try It Now

| | |
|---|---|
| 🌐 **Live App** | [mythos-solana.vercel.app](https://mythos-solana.vercel.app) *(deploy with `vercel --prod`)* |
| 📡 **API Docs** | [mythos-api.railway.app/docs](https://mythos-api.railway.app/docs) *(deploy with `railway up`)* |
| 🔍 **Program** | [Solscan — FGG836...](https://solscan.io/account/FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM?cluster=devnet) |

**One-liner — trigger full AI agent negotiation:**
```bash
curl -X POST https://mythos-api.railway.app/api/solana/workflow/start \
  -H "Content-Type: application/json" \
  -d '{"amount_usdc": 1000, "term_months": 6, "collateral_symbol": "SOL"}'
```

> No wallet needed — click **⚡ One-Click Demo** on the live app to watch Lenny × Luna negotiate a loan instantly.


## 🚀 What is Mythos?

**Mythos** is an AI-native, agentic DeFi lending protocol built natively on Solana. It eliminates the human negotiation bottleneck in DeFi lending by deploying two autonomous AI agents:

- 🤖 **Lenny** — the borrower agent. Reads your on-chain credit attestation (SAS), checks collateral prices via Jupiter, pays x402 micropayments to access AI services, and fights for the lowest possible interest rate.
- 🌙 **Luna** — the lender agent. Prices risk based on SAS credit tiers, evaluates counter-offers, and co-signs the final Anchor transaction.

Every AI service call between agents is governed by **x402** — the HTTP 402 Payment Required standard for machine-to-machine payments. Agents autonomously pay each other in USDC on Solana. No human clicks required.

### Why This Wins the Hackathon

| Hackathon Theme | Mythos Implementation |
|---|---|
| **Agentic Commerce** | Lenny & Luna are autonomous CrewAI agents that negotiate, pay, and settle — zero human intervention |
| **x402 Payments** | Every `/api/agent/*` endpoint requires a USDC micropayment in the `X-PAYMENT` header |
| **Identity & Stablecoins** | Solana Attestation Service (SAS) for on-chain credit identity, USDC for all payments |
| **Solana Performance** | Anchor program live on Devnet, Helius RPC, Jupiter price feeds, <400ms settlement |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite + Framer Motion)          │
│  ┌──────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │ Phantom/     │  │ Agent Negotiation   │  │ x402 Payment      │  │
│  │ Solflare     │  │ Live Feed (Lenny×   │  │ Visualizer        │  │
│  │ Wallet       │  │ Luna dialogue)      │  │ (USDC micropays)  │  │
│  └──────────────┘  └─────────────────────┘  └───────────────────┘  │
│                        Helius WebSocket Live Ticker                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ REST API / WebSocket
┌───────────────────────────▼─────────────────────────────────────────┐
│                   BACKEND (FastAPI + x402 Middleware)               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Lenny Agent  │  │ Luna Agent   │  │ x402 Payment Gate         │ │
│  │ (CrewAI)     │  │ (CrewAI)     │  │ /api/agent/* → 402 →      │ │
│  │ SAS + Jup    │  │ Risk Pricing │  │ X-PAYMENT header verify   │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ SAS Client   │  │ Helius RPC   │                                 │
│  │ (Attestation)│  │ (Webhooks)   │                                 │
│  └──────────────┘  └──────────────┘                                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Anchor CPI
┌───────────────────────────▼─────────────────────────────────────────┐
│                   SOLANA DEVNET (Anchor Program)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ LoanAccount  │  │ Collateral   │  │ Solana Attestation        │ │
│  │ PDA          │  │ Vault (SPL)  │  │ Service (SAS) PDAs        │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│              Program: FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM │
└─────────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │  Jupiter Price API        │
              │  SOL/USDC/BONK real-time  │
              └───────────────────────────┘
```

### How a Loan Works

```
1. User connects Phantom wallet
2. Lenny reads SAS credit attestation (on-chain PDA)
3. Lenny calls /api/agent/evaluate  [X-PAYMENT: 0.001 USDC via x402]
4. Luna prices risk based on SAS tier + Jupiter collateral value
5. Lenny counter-offers            [X-PAYMENT: 0.0005 USDC via x402]
6. Luna accepts/counters (2–3 rounds, ~5 seconds total)
7. Lenny broadcasts Anchor instruction: initialize_loan()
8. Collateral locked in SPL token vault PDA
9. USDC disbursed to borrower wallet
10. Helius webhook fires → dashboard updates in real-time
```

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+, Node.js 18+
- Free [Helius API key](https://helius.dev) (optional — demo mode works without it)
- Free [Groq API key](https://console.groq.com) (optional — simulation mode works without it)

### 1. Clone & Configure

```bash
git clone https://github.com/MUTHUKUMARAN-K-1/Proj_Mythos.git
cd Proj_Mythos
cp .env.example .env
# Add your HELIUS_API_KEY and GROQ_API_KEY
```

### 2. Start the Backend

```bash
pip install -r requirements.txt
cd backend/api
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
API docs: **http://localhost:8000/docs**

### 3. Start the Frontend

```bash
cd frontend/Dashboard
npm install && npm run dev
```
Open: **http://localhost:5173**

### 4. Try the Demo

1. Click **"Connect Wallet"** (Phantom, Solflare, or Demo mode)
2. Set loan amount, term, collateral token
3. Click **"Start AI Negotiation"**
4. Watch Lenny & Luna negotiate live — x402 micropayments flow in real-time

---

## 💸 x402 Payment Protocol

Mythos is one of the first DeFi protocols to implement **x402** — the HTTP 402 Payment Required standard for machine-to-machine payments on Solana.

```
Agent (Lenny)                    Mythos API                    Solana
     │                               │                            │
     │  POST /api/agent/evaluate     │                            │
     │──────────────────────────────>│                            │
     │  HTTP 402 Payment Required    │                            │
     │  X-PAYMENT-REQUIRED: {        │                            │
     │    scheme: "exact",           │                            │
     │    asset: USDC_DEVNET_MINT,   │                            │
     │    amount: 1000 (0.001 USDC)  │                            │
     │  }                            │                            │
     │<──────────────────────────────│                            │
     │  [Lenny pays 0.001 USDC]      │──── SPL Transfer ─────────>│
     │  POST /api/agent/evaluate     │                            │
     │  X-PAYMENT: base64({sig})     │  getTransaction(sig)       │
     │──────────────────────────────>│──────────────────────────>│
     │                               │  ✅ Verified               │
     │  200 OK: AI evaluation result │<──────────────────────────│
     │<──────────────────────────────│                            │
```

### x402-Protected Endpoints

| Endpoint | Price | Purpose |
|---|---|---|
| `POST /api/agent/evaluate` | 0.001 USDC | AI loan evaluation |
| `POST /api/agent/negotiate` | 0.0005 USDC | Counter-offer submission |
| `POST /api/agent/attest` | 0.002 USDC | Credit attestation request |

---

## 🪪 Solana Attestation Service (SAS)

Instead of ZK proofs (complex, expensive), Mythos uses **SAS** — Solana's native on-chain attestation system — for credit scoring.

```python
CREDIT_TIERS = {
    "AAA": {"rate_bps": 700,  "max_loan": 100_000},  # Exceptional
    "AA":  {"rate_bps": 800,  "max_loan":  75_000},  # Very Good
    "A":   {"rate_bps": 950,  "max_loan":  50_000},  # Good
    "B":   {"rate_bps": 1100, "max_loan":  25_000},  # Fair
    "C":   {"rate_bps": 1300, "max_loan":  10_000},  # Limited
}
```

Each attestation is a **PDA** on Solana storing the borrower's credit tier, max loan amount, and LTV ratio — verifiable by any program without revealing raw financial data.

---

## 🔧 API Reference

### Solana-Native Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/solana/attest` | Issue SAS credit attestation |
| `GET` | `/api/solana/attest/{pubkey}` | Verify existing attestation |
| `GET` | `/api/solana/price/{symbol}` | Jupiter price (SOL/USDC/BONK) |
| `GET` | `/api/solana/network` | Helius network stats |
| `GET` | `/api/solana/x402/stats` | x402 payment gate statistics |
| `POST` | `/api/solana/workflow/start` | Start full AI lending workflow |

### x402-Gated Agent Endpoints

| Method | Endpoint | Price | Description |
|---|---|---|---|
| `POST` | `/api/agent/evaluate` | 0.001 USDC | AI loan evaluation (SAS + Jupiter) |
| `POST` | `/api/agent/negotiate` | 0.0005 USDC | Submit counter-offer to Luna |

### WebSocket Events

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
// Events: attestation_issued | negotiation_round | agent_evaluation | workflow_complete
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contract** | Anchor (Rust) on Solana Devnet |
| **AI Agents** | CrewAI + Groq Llama 3.3 70B |
| **Payment Gate** | x402 HTTP 402 middleware (custom) |
| **RPC & Events** | Helius Enhanced API + Webhooks |
| **Prices** | Jupiter Price API v6 |
| **Credit Identity** | Solana Attestation Service (SAS) |
| **Backend** | FastAPI (Python) |
| **Frontend** | React 18 + TypeScript + Vite + Framer Motion |
| **Wallet** | Phantom / Solflare + demo mode |

---

## 📁 Project Structure

```
Proj_Mythos/
├── programs/mythos/src/lib.rs      # Anchor smart contract
│   ├── initialize_loan()           # Lock collateral, open loan
│   ├── accept_loan()               # Luna disburses USDC
│   ├── repay_loan()                # Release collateral
│   └── liquidate()                 # Seize overdue collateral
├── agents/
│   ├── solana_borrower_agent.py    # Lenny — x402 + SAS + Jupiter
│   └── solana_lender_agent.py      # Luna — risk pricing
├── backend/api/
│   ├── server.py                   # FastAPI app
│   ├── x402_middleware.py          # HTTP 402 payment gate
│   ├── attestation.py              # SAS client
│   └── helius_client.py            # Helius RPC + webhooks
└── frontend/Dashboard/src/
    ├── components/AgentNegotiationFeed.tsx
    ├── components/X402PaymentVisualizer.tsx
    └── pages/MythosPage.tsx
```

---

## 🚀 Live Deployment — Solana Devnet

> **The Mythos Anchor program is deployed and live on Solana Devnet.**

| | |
|---|---|
| **Program ID** | `FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM` |
| **Network** | Solana **Devnet** |
| **Deploy Wallet** | `61m3ESHMhzDygAUWkSyXTCBr6Jy9gSnSF3Dqm6fxhg6s` |
| **Deploy TX** | [`3twz9fk...`](https://explorer.solana.com/tx/3twz9fkqZWktXGXukqGZqrwJLpY41A8iLmjyPN3TwWP4J4fobtUYNZPbshxkS6cdDqCAAT8t3xVFE8zw3y5TBrig?cluster=devnet) |
| **Deployed Slot** | `456903617` |
| **Solscan** | [View Program](https://solscan.io/account/FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM?cluster=devnet) |
| **Explorer** | [View Program](https://explorer.solana.com/address/FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM?cluster=devnet) |
| **Toolchain** | Rust 1.95 stable + cargo-build-sbf (Agave 3.1.13) |

### Redeploy from Source

```bash
# 1. Build
cargo-build-sbf --manifest-path programs/mythos/Cargo.toml

# 2. Deploy
solana program deploy target/deploy/mythos.so \
  --keypair ~/.config/solana/id.json \
  --program-id target/deploy/mythos-keypair.json \
  --url devnet

# 3. Verify
solana program show FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM --url devnet
```

---

## 🔑 Environment Variables

```env
# Solana (live on Devnet)
SOLANA_NETWORK=devnet
MYTHOS_PROGRAM_ID=FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM
TREASURY_WALLET=61m3ESHMhzDygAUWkSyXTCBr6Jy9gSnSF3Dqm6fxhg6s
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# APIs (free tier sufficient)
HELIUS_API_KEY=your_key      # https://helius.dev
GROQ_API_KEY=your_key        # https://console.groq.com

# Frontend
VITE_API_URL=http://localhost:8000
VITE_SOLANA_NETWORK=devnet
VITE_PROGRAM_ID=FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM
```

---

## 🏆 Hackathon Alignment

**Solana Hackathon 2026 — Track: Agentic Commerce, Identity, Payments & Stablecoins**

| Criterion | Evidence |
|---|---|
| Solana scalability | Anchor program live on Devnet (`FGG836...`), Helius RPC, <400ms settlement |
| Composability | SAS + Jupiter + x402 + Anchor — one unified agentic flow |
| Agentic commerce | Lenny & Luna pay each other M2M via x402 — zero human clicks |
| Identity | SAS on-chain credit attestation PDAs replace centralized credit bureaus |
| Stablecoins | USDC for x402 micropayments AND loan disbursement |
| Innovation | First DeFi protocol gating AI-to-AI calls behind x402 USDC micropayments |
| Technical skill | Rust/Anchor + CrewAI + FastAPI + React + Helius — full Solana stack |
| Real-world impact | Eliminates human negotiation bottleneck in DeFi lending |

---

<div align="center">

Built with ◎ for the Solana Hackathon 2026

**[Program on Explorer](https://explorer.solana.com/address/FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM?cluster=devnet) · [Deploy TX](https://explorer.solana.com/tx/3twz9fkqZWktXGXukqGZqrwJLpY41A8iLmjyPN3TwWP4J4fobtUYNZPbshxkS6cdDqCAAT8t3xVFE8zw3y5TBrig?cluster=devnet)**

**[⬆ Back to Top](#-mythos)**

</div>
