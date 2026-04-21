# Lendora AI - Deployment Guide

## Quick Start (5 minutes)

### Prerequisites

- Node.js 18+ installed
- Vercel CLI installed (`npm i -g vercel`)
- Railway CLI installed (`npm i -g @railway/cli`)
- Git repository initialized

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   VERCEL        │     │   RAILWAY       │
│   (Frontend)    │ ---> │   (Backend)    │
│   React + Vite  │     │   FastAPI       │
│   Static Assets │     │   WebSocket     │
└─────────────────┘     └─────────────────┘
```

---

## Step 1: Deploy Backend to Railway

### 1.1 Install Railway CLI

```bash
npm install -g @railway/cli
```

### 1.2 Login to Railway

```bash
railway login
```

### 1.3 Initialize and Deploy

```bash
# From project root
railway init

# Link to your project
railway link

# Deploy
railway up
```

### 1.4 Set Environment Variables

In Railway Dashboard → Variables, add:

| Variable           | Value              | Required |
| ------------------ | ------------------ | -------- |
| `PORT`             | `8000`             | Yes      |
| `ETHEREUM_NETWORK` | `arbitrum-sepolia` | Yes      |
| `ETHEREUM_RPC_URL` | Your RPC URL       | Yes      |
| `OLLAMA_BASE_URL`  | Your Ollama URL    | Optional |

### 1.5 Get Your Backend URL

After deployment, Railway will provide a URL like:

```
https://lendora-ai-backend-production.up.railway.app
```

**Save this URL** - you'll need it for the frontend.

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 2.2 Login to Vercel

```bash
vercel login
```

### 2.3 Deploy

```bash
# From project root
vercel
```

When prompted:

- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No (first time) / Yes (subsequent)
- **Project name?** → `lendora-ai` (or your preferred name)
- **Directory?** → `./` (project root)
- **Override settings?** → No (vercel.json handles this)

### 2.4 Set Environment Variables

```bash
# Set your backend URL from Step 1.5
vercel env add VITE_API_URL production
# When prompted, enter: https://your-backend.railway.app

vercel env add VITE_WS_URL production
# When prompted, enter: wss://your-backend.railway.app
```

Or via Vercel Dashboard:

1. Go to your project → Settings → Environment Variables
2. Add:
   - `VITE_API_URL` = `https://your-backend.railway.app`
   - `VITE_WS_URL` = `wss://your-backend.railway.app`

### 2.5 Redeploy with Environment Variables

```bash
vercel --prod
```

---

## Your App is Live!

Vercel will provide your live URL:

```
https://lendora-ai.vercel.app
```

---

## Alternative: Single Command Deployment

### Full Deployment Script

```bash
#!/bin/bash

# Deploy Backend to Railway
echo "Deploying backend to Railway..."
railway up --detach

# Get Railway URL (you'll need to copy this manually from dashboard)
echo "Copy your Railway URL from the dashboard"
read -p "Enter your Railway backend URL: " BACKEND_URL

# Deploy Frontend to Vercel
echo "▲ Deploying frontend to Vercel..."
vercel --yes

# Set environment variables
vercel env add VITE_API_URL production <<< "$BACKEND_URL"
vercel env add VITE_WS_URL production <<< "${BACKEND_URL/https/wss}"

# Production deployment
vercel --prod

echo "Deployment complete!"
```

---

## Troubleshooting

### Error: Build failed on Vercel

**Cause:** Node version mismatch

**Fix:**

```bash
# Ensure Node 20 is used
echo "20" > frontend/Dashboard/.nvmrc
```

### Error: WebSocket connection failed

**Cause:** Mixed content (HTTP/HTTPS)

**Fix:** Ensure both URLs use HTTPS/WSS:

```
VITE_API_URL=https://...  (not http://)
VITE_WS_URL=wss://...     (not ws://)
```

### Error: CORS blocked

**Cause:** Backend not configured for your frontend domain

**Fix:** The backend already allows all origins (`allow_origins=["*"]`), but for production, consider restricting this in `backend/api/server.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.vercel.app"],
    ...
)
```

### Error: API returns 404

**Cause:** Backend not running or wrong URL

**Fix:**

1. Check Railway logs: `railway logs`
2. Verify health endpoint: `curl https://your-backend.railway.app/health`

### Error: 250MB limit exceeded on Vercel (backend)

**Cause:** AI dependencies too large for Vercel serverless

**Fix:** This is why we use Railway for the backend. The `api/index.py` is a minimal fallback only.

---

## Environment Variables Reference

### Frontend (Vercel)

| Variable       | Description     | Example                       |
| -------------- | --------------- | ----------------------------- |
| `VITE_API_URL` | Backend API URL | `https://backend.railway.app` |
| `VITE_WS_URL`  | WebSocket URL   | `wss://backend.railway.app`   |

### Backend (Railway)

| Variable           | Description           | Example                                    |
| ------------------ | --------------------- | ------------------------------------------ |
| `PORT`             | Server port           | `8000`                                     |
| `HOST`             | Server host           | `0.0.0.0`                                  |
| `ETHEREUM_NETWORK` | Ethereum network      | `arbitrum-sepolia`                         |
| `ETHEREUM_RPC_URL` | RPC endpoint          | `https://arb-sepolia.g.alchemy.com/v2/...` |
| `OLLAMA_BASE_URL`  | Ollama API (optional) | `http://ollama:11434`                      |

---

## Security Checklist

- [ ] Never commit `.env` files to git
- [ ] Use Railway/Vercel secrets for sensitive data
- [ ] Set specific CORS origins in production
- [ ] Use HTTPS/WSS only in production
- [ ] Rotate API keys regularly

---

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Railway Docs:** https://docs.railway.app
- **FastAPI Docs:** https://fastapi.tiangolo.com
