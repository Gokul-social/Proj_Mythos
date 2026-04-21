# How to Start Lendora AI

This guide will help you get the Lendora AI project running locally.

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Docker** and Docker Compose (optional, for containerized deployment)
- **Git**

## Quick Start (Docker - Recommended)

The easiest way to run the full stack:

```bash
# 1. Clone the repository (if you haven't already)
cd Lendora-AI

# 2. Create environment file (optional, uses defaults if not present)
cp env.example .env

# 3. Start all services
./deploy.sh

# Or manually:
docker-compose up -d
```

**Access Points:**

- Frontend: http://localhost:80
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

**Useful Commands:**

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart
```

## Manual Setup (Development)

### Step 1: Backend Setup

```bash
# 1. Navigate to backend
cd backend/api

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install root-level dependencies (for agents)
cd ../..
pip install -r requirements.txt

# 4. Create environment file (optional)
cp env.example .env

# 5. Start the backend server
cd backend/api
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at:

- REST API: http://localhost:8000
- WebSocket: ws://localhost:8000/ws
- API Docs: http://localhost:8000/docs

### Step 2: Frontend Setup

Open a **new terminal**:

```bash
# 1. Navigate to frontend
cd frontend/Dashboard

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Start development server
npm run dev
```

Frontend will be available at: http://localhost:8080

### Step 3: (Optional) AI Agents with Ollama

For full AI agent functionality, you need Ollama running:

```bash
# Install Ollama (if not already installed)
# macOS:
brew install ollama

# Linux:
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama
ollama serve

# In another terminal, pull the model
ollama pull llama3
```

## Environment Variables

### Backend (.env in project root)

```env
# Server Configuration
PORT=8000
HOST=0.0.0.0

# Ollama Configuration (for AI agents)
OLLAMA_BASE_URL=http://localhost:11434

# Ethereum Configuration
ETHEREUM_NETWORK=arbitrum-testnet
ETHEREUM_RPC_URL=https://arbitrum-goerli.infura.io/v3/YOUR_PROJECT_ID

# Credit Oracle (optional)
CREDIT_ORACLE_URL=https://api.credit-oracle.com
CREDIT_ORACLE_API_KEY=your_api_key_here
```

### Frontend (.env in frontend/Dashboard/)

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## Project Structure

```
Lendora-AI/
├── backend/
│   ├── api/              # FastAPI backend server
│   ├── ethereum/          # Ethereum transaction builder
│   ├── oracles/           # Chainlink oracle client
│   └── zk/                # ZK proof generator (Circom/SnarkJS)
├── frontend/
│   └── Dashboard/         # React frontend application
├── contracts/
│   └── core/              # Solidity smart contracts
├── agents/                # AI agents (CrewAI)
└── docs/                   # Documentation
```

## Troubleshooting

### Backend Issues

**Problem**: Import errors or missing modules

```bash
# Solution: Install all dependencies
pip install -r requirements.txt
pip install -r backend/api/requirements.txt
```

**Problem**: Port 8000 already in use

```bash
# Solution: Change port in .env or use different port
PORT=8001 uvicorn server:app --host 0.0.0.0 --port 8001
```

**Problem**: AI agents not working

```bash
# Solution: Ensure Ollama is running
ollama serve
# Check if model is available
ollama list
```

### Frontend Issues

**Problem**: Cannot connect to backend

```bash
# Solution: Check VITE_API_URL in frontend/Dashboard/.env
# Should be: VITE_API_URL=http://localhost:8000
```

**Problem**: npm install fails

```bash
# Solution: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Problem**: TypeScript errors

```bash
# Solution: Restart your IDE/editor after npm install
```

### Docker Issues

**Problem**: Docker build fails

```bash
# Solution: Check Docker is running
docker ps

# Rebuild without cache
docker-compose build --no-cache
```

**Problem**: Services won't start

```bash
# Solution: Check logs
docker-compose logs backend
docker-compose logs frontend
```

## What to Expect

1. **Login Portal** (http://localhost:8080):

   - 3D rotating cube interface
   - Wallet connection (Note: Currently has Cardano wallet code - needs Ethereum wallet integration)

2. **Dashboard** (http://localhost:8080/dashboard):

   - Real-time loan negotiation interface
   - AI agent status
   - WebSocket-powered updates

3. **API Documentation** (http://localhost:8000/docs):
   - Interactive API documentation
   - Test endpoints directly

## Next Steps

1. **Ethereum Wallet Integration**: The frontend currently has Cardano wallet code. You'll need to integrate MetaMask or WalletConnect for Ethereum.

2. **Configure Ethereum RPC**: Update `ETHEREUM_RPC_URL` in `.env` with your Infura or Alchemy endpoint.

3. **Deploy Smart Contracts**: Deploy the Solidity contracts to your chosen Ethereum L2 network.

4. **Test the Workflow**: Start a loan request and test the complete flow.

## Production Deployment

For production deployment, see:

- `docker-compose.prod.yml` for production Docker setup
- `docs/DEPLOYMENT.md` for detailed deployment guide

## Need Help?

- Check `CLEANUP_SUMMARY.md` for post-migration cleanup details
- Review `docs/` directory for architecture and feature documentation
- Check API docs at http://localhost:8000/docs when backend is running

