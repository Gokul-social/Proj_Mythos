# Mythos — Demo Script
### For Hackathon Judges / Live Presentation

---

## ⏱ 2-Minute Demo Flow

### Step 0: Setup (before the demo, ~2 mins)

```bash
# Terminal 1: Backend
cd backend/api && uvicorn server:app --port 8000 --reload

# Terminal 2: Frontend
cd frontend/Dashboard && npm install && npm run dev
```

Open **http://localhost:5173** in browser.

---

### Step 1: Show the Landing Page (0:00–0:20)

> *"This is Mythos — AI-native DeFi lending on Solana. Instead of you negotiating loan terms with a human lender, two AI agents do it for you, autonomously, on-chain."*

Point out:
- **Top badges**: x402 · SAS · Helius · Jupiter (the four Solana-native integrations)
- **Hero stats**: Live SOL price pulled from Jupiter API, TPS, settlement time
- **Feature cards**: AI Negotiation, x402 Payments, SAS Attestations, Anchor Programs

---

### Step 2: Connect Wallet (0:20–0:35)

> *"I'll connect my Phantom wallet — or if you don't have one, the app has a built-in demo mode."*

Click **"Connect Wallet"** in the top right.
- If Phantom is installed → approve connection
- If not → click "Demo Mode" → app generates a fake wallet address

> *"Solana wallet connected. The app has already fetched my SAS credit attestation — that's my on-chain credit score, stored as a PDA on Solana instead of in some centralized database."*

---

### Step 3: Submit a Loan Request (0:35–1:00)

Click **"Start AI Loan Negotiation"** to go to the demo panel.

Set parameters:
- Amount: **$1,000 USDC**
- Term: **12 months**
- Collateral: **SOL**

Show the info panel:
> *"Luna's opening rate is 9.5% APR. My SAS attestation says I'm Tier A — so Lenny is going to negotiate her down."*

Click **"Start AI Negotiation"**.

---

### Step 4: Watch the Negotiation (1:00–1:40)

Point to the **Agent Negotiation Feed** (middle panel):

> *"This is where it gets interesting. Lenny, my borrower agent, just called our AI evaluation endpoint — but first, it had to pay 0.001 USDC via x402. That's the HTTP 402 Payment Required protocol — every AI service call is a paid, autonomous machine-to-machine transaction."*

Watch the animated dialogue:
- 🔵 Lenny: "Requesting $1,000 USDC at 9.5% for 12 months"
- 🟣 Luna: "Counter-offer: 8.75% APR"
- 🔵 Lenny: "Counter: 8.0% APR"
- ✅ "Loan settled at 8.25% APR"

Point to **x402 Payment Visualizer** (right panel):
> *"On the right you can see the micropayments flowing — each round-trip costs the agents fractions of a cent. This is the Solana economy for AI agents."*

---

### Step 5: Show the On-Chain Proof (1:40–2:00)

Point to **Helius Live Feed** (bottom ticker):
> *"Down here is the Helius real-time event stream — every Solana event from our Anchor program lands here instantly via webhook."*

Click **"View Anchor Program"** → opens Solscan:
> *"And here's our Anchor program on Solana Devnet — the loan lifecycle instructions: initialize, accept, repay, liquidate."*

---

## 🎯 Key Talking Points

| Judge Question | Your Answer |
|---|---|
| "Why Solana?" | Sub-second settlement, 4000 TPS, $0.00025 tx fees — the only chain where AI micropayments make economic sense |
| "What's novel?" | First DeFi protocol to use x402 (HTTP 402) for agent-to-agent payments. Agents pay each other autonomously. |
| "Does it actually work?" | Backend is live at localhost:8000 — hit /docs to see all Solana routes. x402 middleware intercepts and verifies payments in real-time. |
| "What's SAS?" | Solana Attestation Service — on-chain PDAs that store credit identity without revealing raw data. Replaces ZK proofs with Solana-native primitives. |
| "What's the business model?" | Protocol takes a fee from x402 micropayments on every AI service call. Luna also earns interest spread. |

---

## 🛠 API Live Demo (Optional, for technical judges)

```bash
# 1. Check network stats (Helius)
curl http://localhost:8000/api/solana/network

# 2. Get live SOL price (Jupiter)
curl http://localhost:8000/api/solana/price/SOL

# 3. Issue SAS attestation
curl -X POST http://localhost:8000/api/solana/attest \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "Demo1111111111111111111111111111111111111111", "credit_score": 720}'

# 4. Try hitting agent endpoint WITHOUT payment (expect 402)
curl -X POST http://localhost:8000/api/agent/evaluate \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "Demo111...", "amount_usdc": 1000}'
# → HTTP 402 with X-PAYMENT-REQUIRED header

# 5. Simulate payment and retry
PAYMENT=$(curl -s http://localhost:8000/api/solana/x402/simulate/lenny | python -c "import sys,json; print(json.load(sys.stdin)['header'])")
curl -X POST http://localhost:8000/api/agent/evaluate \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: $PAYMENT" \
  -d '{"borrower_pubkey": "Demo111...", "amount_usdc": 1000}'
# → 200 OK with AI evaluation
```

---

## 📱 Backup Plan (if backend is down)

The frontend runs **entirely client-side** in demo mode:
- Wallet → Demo Mode (no extension needed)
- Agent negotiation → animated locally (useNegotiationMessages hook)
- x402 payments → client-side simulation
- Helius feed → local event generator

The demo **will work** even with no backend running.
