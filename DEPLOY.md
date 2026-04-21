# Mythos — Deployment Guide (Solana Devnet)

Complete guide to build, deploy, and verify the Mythos Anchor program on Solana Devnet.

---

## Prerequisites

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup install 1.79.0
rustup default 1.79.0
```

### 2. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.22/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
```

### 3. Install Anchor CLI

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.30.1
avm use 0.30.1
anchor --version
```

### 4. Install Node.js Dependencies

```bash
cd /path/to/Proj_Mythos
npm install
```

---

## Configuration

### 1. Configure Solana CLI for Devnet

```bash
solana config set --url https://api.devnet.solana.com
solana config set --keypair ~/.config/solana/id.json
```

### 2. Generate or Import Deployer Keypair

**Generate new keypair:**
```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

**Or import existing keypair:**
```bash
solana-keygen recover --outfile ~/.config/solana/id.json
```

### 3. Airdrop SOL (Devnet)

You need ~5 SOL for deployment + account creation:

```bash
solana airdrop 5
solana balance
```

If the faucet rate-limits you, wait 30 seconds and retry, or use the Solana faucet web UI:
https://faucet.solana.com/

### 4. Verify Configuration

```bash
solana config get
# Expected output:
# Config File: ~/.config/solana/cli/config.yml
# RPC URL: https://api.devnet.solana.com
# WebSocket URL: wss://api.devnet.solana.com/
# Keypair Path: ~/.config/solana/id.json
# Commitment: confirmed
```

---

## Build

### 1. Build the Anchor Program

```bash
cd /path/to/Proj_Mythos
anchor build
```

This will:
- Compile the Rust program to BPF bytecode
- Generate the IDL at `target/idl/mythos.json`
- Generate TypeScript types at `target/types/mythos.ts`
- Create the program keypair at `target/deploy/mythos-keypair.json`

### 2. Get the Program ID

After the first build, a keypair is generated. Extract the program ID:

```bash
solana address -k target/deploy/mythos-keypair.json
```

### 3. Update Program ID Everywhere

Replace the placeholder `MythoST111111111111111111111111111111111111` with the real program ID:

```bash
# Get the actual program ID
PROGRAM_ID=$(solana address -k target/deploy/mythos-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update lib.rs
sed -i '' "s/MythoST111111111111111111111111111111111111/$PROGRAM_ID/g" programs/mythos/src/lib.rs

# Update Anchor.toml
sed -i '' "s/MythoST111111111111111111111111111111111111/$PROGRAM_ID/g" Anchor.toml

# Update .env.example
sed -i '' "s/MythoST111111111111111111111111111111111111/$PROGRAM_ID/g" .env.example

# Update IDL metadata
sed -i '' "s/MythoST111111111111111111111111111111111111/$PROGRAM_ID/g" target/idl/mythos.json
```

### 4. Rebuild with Correct Program ID

```bash
anchor build
```

---

## Deploy

### 1. Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

Expected output:
```
Deploying workspace: https://api.devnet.solana.com
Upgrade authority: ~/.config/solana/id.json
Deploying program "mythos"...
Program path: target/deploy/mythos.so
Program Id: <YOUR_PROGRAM_ID>

Deploy success
```

### 2. Verify Deployment

```bash
# Check program exists on-chain
solana program show <YOUR_PROGRAM_ID>

# View on Solana Explorer
echo "https://explorer.solana.com/address/<YOUR_PROGRAM_ID>?cluster=devnet"
```

---

## Initialize Protocol

After deployment, initialize the protocol state (one-time operation):

```bash
# Using the Anchor test framework (recommended)
anchor test --provider.cluster devnet --skip-deploy
```

Or initialize manually via the backend:

```bash
# Start backend
cd backend/api
pip install -r requirements.txt
SOLANA_DEMO_MODE=false MYTHOS_PROGRAM_ID=<YOUR_PROGRAM_ID> python -c "
import asyncio
from solana_client import MythosClient
from solders.pubkey import Pubkey

async def init():
    client = MythosClient.from_env()
    treasury = client.payer.pubkey()  # Use deployer as treasury for now
    tx = await client.initialize_protocol(treasury, 15000, 12000)
    print(f'Protocol initialized: {tx}')
    await client.close()

asyncio.run(init())
"
```

---

## Run Tests

### Local Validator Tests

```bash
anchor test
```

This starts a local validator, deploys the program, and runs the full test suite.

### Devnet Tests

```bash
anchor test --provider.cluster devnet
```

---

## Backend Setup

### 1. Install Python Dependencies

```bash
cd backend/api
pip install -r requirements.txt
```

### 2. Create `.env` File

```bash
cp ../../.env.example .env
# Edit .env with your actual values:
# - MYTHOS_PROGRAM_ID=<YOUR_PROGRAM_ID>
# - HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=<YOUR_API_KEY>
# - SOLANA_DEMO_MODE=false  (for real on-chain operations)
# - SOLANA_KEYPAIR_PATH=~/.config/solana/id.json
```

### 3. Start Backend

```bash
cd backend/api
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Test API Endpoints

```bash
# Health check
curl http://localhost:8000/health

# Get protocol state
curl http://localhost:8000/api/solana/protocol

# Initialize a loan
curl -X POST http://localhost:8000/api/solana/initialize-loan \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": 1,
    "principal": 1000000,
    "interest_rate_bps": 750,
    "term_seconds": 2592000,
    "collateral_mint": "So11111111111111111111111111111111111111112",
    "stablecoin_mint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
  }'

# Fetch loan state
curl http://localhost:8000/api/solana/loan/<BORROWER_PUBKEY>/1
```

---

## Troubleshooting

### Insufficient SOL

**Error:** `Transaction simulation failed: Attempt to debit an account but found no record of a prior credit`

**Fix:**
```bash
solana airdrop 5
# If rate-limited, wait 30s and retry
solana airdrop 2
solana airdrop 2
```

### Invalid PDA

**Error:** `Error: AnchorError ... A seeds constraint was violated`

**Fix:** Ensure PDA seeds match exactly:
```
loan PDA:     ["loan",     borrower_pubkey_bytes, loan_id_le_bytes]
vault PDA:    ["vault",    loan_pda_bytes]
protocol PDA: ["protocol"]
```

The loan_id must be encoded as **little-endian u64** (8 bytes).

### Token Account Missing

**Error:** `Error: Account ... could not be parsed as token account`

**Fix:** Create the associated token account before interacting:
```bash
spl-token create-account <MINT_ADDRESS>
```

Or in code:
```typescript
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
const ata = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint, owner
);
```

### Program Already Deployed (Upgrade)

**Error:** `Error: program ... already deployed`

**Fix:** Use `anchor upgrade` instead:
```bash
anchor upgrade target/deploy/mythos.so --program-id <PROGRAM_ID> --provider.cluster devnet
```

### Anchor Build Fails (BPF toolchain)

**Error:** `error: could not compile ... for BPF target`

**Fix:**
```bash
# Install BPF SDK
solana-install update
cargo build-sbf --version
# If missing:
cargo install --git https://github.com/solana-labs/cargo-build-sbf
```

### Account Already Initialized

**Error:** `Error: AccountAlreadyInitialized`

This means the protocol or loan PDA already exists. For protocol, this is expected (only initialize once). For loans, use a different `loan_id`.

### Clock Drift on Local Validator

**Error:** Tests fail with time-related checks

**Fix:** The local validator uses simulated time. Use `--slots-per-epoch 32` for faster epochs:
```bash
solana-test-validator --slots-per-epoch 32 --reset
```

---

## Environment Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `MYTHOS_PROGRAM_ID` | Deployed program address | `MythoS...` |
| `HELIUS_RPC_URL` | Helius devnet RPC endpoint | `https://devnet.helius-rpc.com/?api-key=KEY` |
| `SOLANA_KEYPAIR_PATH` | Path to deployer keypair | `~/.config/solana/id.json` |
| `SOLANA_DEMO_MODE` | `true` = mock data, `false` = real on-chain | `false` |
| `SOLANA_NETWORK` | Network name | `devnet` |
| `USDC_MINT` | USDC mint address (devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
