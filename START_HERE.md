# Mythos - Start Here

> **AI-native agentic lending on Solana.**
> Two AI agents (Lenny the borrower, Luna the lender) negotiate your loan rate in real-time,
> pay each other via x402 HTTP micropayments, and settle on-chain via Anchor.

## What's Already Done

- Anchor program deployed to Devnet: `FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM`
- Frontend (Vite + React + Solana wallet adapter)
- Backend (FastAPI + Groq LLM + Helius RPC + Jupiter price feed)

You **do not need to rebuild or redeploy** the Anchor program unless modifying `programs/mythos/src/lib.rs`.

---

## Local Setup (6 steps)

```mermaid
graph LR
    A[Clone Repo] --> B[Setup Backend .env]
    B --> C[Start Backend]
    C --> D[Setup Frontend .env]
    D --> E[Start Frontend]
    E --> F[Open Browser]
```

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Helius API key (free at [helius.dev](https://helius.dev))
- A Groq API key (free at [console.groq.com](https://console.groq.com))

---

### Step 1 - Clone

```bash
git clone https://github.com/MUTHUKUMARAN-K-1/Proj_Mythos
cd Proj_Mythos
```

### Step 2 - Backend environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
HELIUS_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

Everything else can stay as-is for a devnet demo.

### Step 3 - Start backend

```bash
pip install -r requirements.txt
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

Verify: `curl http://localhost:8000/health` -> `{"status":"ok","network":"devnet"}`

### Step 4 - Frontend environment

```bash
cp frontend/Dashboard/.env.example frontend/Dashboard/.env
```

Edit `frontend/Dashboard/.env` and add your `VITE_HELIUS_API_KEY`.

### Step 5 - Start frontend

```bash
cd frontend/Dashboard
npm install
npm run dev
```

### Step 6 - Open the app

Go to `http://localhost:5173`

- **No wallet needed** for the demo - click **"Try Demo"**
- Connect **Phantom** (Devnet mode) to sign real Anchor transactions

---

## Anchor Program (optional rebuild)

Only required if you modify `programs/mythos/src/lib.rs`.

```bash
# On Windows with Solana tools:
$env:CARGO_TARGET_DIR = "D:\DevTools\cargo-target"
cargo-build-sbf --manifest-path programs/mythos/Cargo.toml

# Deploy
solana program deploy target/deploy/mythos.so \
  --program-id FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM \
  --url devnet
```

---

## Verify on Solana Explorer

Program: [FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM](https://explorer.solana.com/address/FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM?cluster=devnet)

Deploy TX: [3twz9fk...](https://explorer.solana.com/tx/3twz9fkqZWktXGXukqGZqrwJLpY41A8iLmjyPN3TwWP4J4fobtUYNZPbshxkS6cdDqCAAT8t3xVFE8zw3y5TBrig?cluster=devnet)
