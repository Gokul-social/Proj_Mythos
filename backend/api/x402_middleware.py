"""
Mythos - x402 Payment Gate Middleware
"""

import json
import os
import base64
import hashlib
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import Request, Response
from fastapi.responses import JSONResponse

from .config import (
    SOLANA_NETWORK,
    TREASURY_WALLET,
    USDC_MINT_DEVNET,
    HELIUS_RPC_URL,
    X402_DEMO_MODE
)

# Payment configuration
PAYMENT_CONFIG = {
    "version": "1",
    "network": SOLANA_NETWORK,
    "treasury_wallet": TREASURY_WALLET,
    "usdc_mint_devnet": USDC_MINT_DEVNET,
    "price_per_evaluation": 1000,      # 0.001 USDC (6 decimals)
    "price_per_negotiation": 500,       # 0.0005 USDC
    "price_per_attestation": 2000,      # 0.002 USDC
}

# Paths that require x402 payment
PAYMENT_REQUIRED_PATHS = {
    "/api/agent/evaluate": PAYMENT_CONFIG["price_per_evaluation"],
    "/api/agent/negotiate": PAYMENT_CONFIG["price_per_negotiation"],
    "/api/agent/attest": PAYMENT_CONFIG["price_per_attestation"],
}

# In-memory cache of verified payments (tx_hash -> expiry)
_verified_payments: Dict[str, datetime] = {}
_payment_lock = asyncio.Lock()


def build_402_response(path: str, amount: int) -> JSONResponse:
    """Build the HTTP 402 Payment Required response with x402 headers."""
    payment_request = {
        "version": "1",
        "accepts": [
            {
                "scheme": "exact",
                "network": f"solana-{PAYMENT_CONFIG['network']}",
                "maxAmountRequired": str(amount),
                "resource": path,
                "description": f"Mythos AI Agent Service — {path}",
                "mimeType": "application/json",
                "payTo": PAYMENT_CONFIG["treasury_wallet"],
                "maxTimeoutSeconds": 300,
                "asset": PAYMENT_CONFIG["usdc_mint_devnet"],
                "extra": {
                    "name": "USDC",
                    "version": "1"
                }
            }
        ]
    }

    payment_json = json.dumps(payment_request)

    return JSONResponse(
        status_code=402,
        content={
            "error": "Payment Required",
            "message": (
                "This AI service requires a micropayment. "
                "Include X-PAYMENT header with a valid Solana transaction signature."
            ),
            "payment": payment_request,
            "instructions": {
                "step1": f"Send {amount} USDC-devnet to {PAYMENT_CONFIG['treasury_wallet']}",
                "step2": "Include the signature in the X-PAYMENT header",
                "step3": "Retry the request with the payment header",
                "example_header": "X-PAYMENT: <base64(json({network, payload, scheme}))>"
            }
        },
        headers={
            "X-PAYMENT-REQUIRED": base64.b64encode(payment_json.encode()).decode(),
            "Access-Control-Expose-Headers": "X-PAYMENT-REQUIRED"
        }
    )


async def verify_payment_header(payment_header: str, path: str) -> Optional[Dict[str, Any]]:
    """
    Verify the X-PAYMENT header from the agent.
    
    In production: verifies the Solana transaction on-chain via Helius.
    In demo mode: accepts a simulated payment token.
    
    Returns: payment info dict if valid, None if invalid
    """
    try:
        # Decode the payment header (base64 encoded JSON)
        decoded = base64.b64decode(payment_header.encode()).decode()
        payment_data = json.loads(decoded)

        tx_signature = payment_data.get("payload") or payment_data.get("signature", "")
        network = payment_data.get("network", "solana-devnet")
        scheme = payment_data.get("scheme", "exact")

        if not tx_signature:
            print(f"[x402] Missing signature in payment header")
            return None

        # Check if already verified (cache)
        async with _payment_lock:
            if tx_signature in _verified_payments:
                if _verified_payments[tx_signature] > datetime.utcnow():
                    print(f"[x402] ✅ Cached payment: {tx_signature[:20]}...")
                    return {"signature": tx_signature, "cached": True}
                else:
                    del _verified_payments[tx_signature]

        # Demo/Devnet mode: accept simulated payments
        if X402_DEMO_MODE and tx_signature.startswith("SIM_"):
            print(f"[x402] Demo payment accepted: {tx_signature[:30]}...")
            async with _payment_lock:
                _verified_payments[tx_signature] = datetime.utcnow() + timedelta(minutes=5)
            return {
                "signature": tx_signature,
                "amount": PAYMENT_REQUIRED_PATHS.get(path, 1000),
                "network": network,
                "demo": True
            }

        # Real verification via Helius (when not in demo mode)
        verified = await verify_solana_tx_helius(tx_signature, path)
        if verified:
            async with _payment_lock:
                _verified_payments[tx_signature] = datetime.utcnow() + timedelta(minutes=30)
            print(f"[x402] ✅ On-chain payment verified: {tx_signature[:20]}...")
            return {"signature": tx_signature, "network": network, "on_chain": True}

        print(f"[x402] ❌ Payment verification failed: {tx_signature[:20]}...")
        return None

    except Exception as e:
        print(f"[x402] Error verifying payment: {e}")
        return None


async def verify_solana_tx_helius(signature: str, path: str) -> bool:
    """
    Verify a Solana transaction via Helius RPC.
    Checks that:
    1. Transaction is confirmed
    2. Receiver is our treasury wallet
    3. Amount >= required amount
    """
    import httpx

    helius_url = HELIUS_RPC_URL

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(helius_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [
                    signature,
                    {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
                ]
            })
            data = resp.json()

        if data.get("result") is None:
            return False

        tx = data["result"]
        meta = tx.get("meta", {})

        # Check transaction succeeded
        if meta.get("err") is not None:
            return False

        # Check USDC transfer to treasury
        treasury = PAYMENT_CONFIG["treasury_wallet"]
        required_amount = PAYMENT_REQUIRED_PATHS.get(path, 1000)

        pre_balances = meta.get("preTokenBalances", [])
        post_balances = meta.get("postTokenBalances", [])

        for post in post_balances:
            if post.get("owner") == treasury:
                pre_amount = 0
                for pre in pre_balances:
                    if pre.get("accountIndex") == post.get("accountIndex"):
                        pre_amount = int(pre.get("uiTokenAmount", {}).get("amount", 0))
                        break
                post_amount = int(post.get("uiTokenAmount", {}).get("amount", 0))
                received = post_amount - pre_amount
                if received >= required_amount:
                    print(f"[x402] Treasury received {received} USDC-lamports ✅")
                    return True

        return False

    except Exception as e:
        print(f"[x402] Helius verification error: {e}")
        return False


async def x402_middleware(request: Request, call_next):
    """
    path = request.url.path

    if path in PAYMENT_REQUIRED_PATHS:
        payment_header  = request.headers.get("X-PAYMENT", "")
        payment_sig_hdr = request.headers.get("X-Payment-Signature", "")

        if X402_DEMO_MODE:
            # Demo mode: pass through, but tag state so route can see it
            request.state.payment_sig  = payment_sig_hdr or None
            request.state.payment_demo = True
        elif payment_sig_hdr:
            # New style: route handler owns verification — just pass the sig
            request.state.payment_sig  = payment_sig_hdr
            request.state.payment_demo = False
            print(f"[x402] X-Payment-Signature present for {path} — deferring to route verifier")
        elif payment_header:
            # Classic style: verify in middleware
            payment_info = await verify_payment_header(payment_header, path)
            if not payment_info:
                return JSONResponse(
                    status_code=402,
                    content={
                        "error": "Payment Invalid",
                        "message": "Payment verification failed. Provide a valid Solana transaction."
                    }
                )
            print(f"[x402] ✅ Classic X-PAYMENT verified for {path}")
            request.state.payment     = payment_info
            request.state.payment_sig = payment_info.get("signature")
            request.state.payment_demo = False
        else:
            required_amount = PAYMENT_REQUIRED_PATHS[path]
            print(f"[x402] 💸 Payment required for {path} ({required_amount} USDC-lamports)")
            return build_402_response(path, required_amount)

    response = await call_next(request)
    return response


def simulate_agent_payment(path: str, agent_name: str = "lenny") -> str:
    """
    Simulate an agent making a payment (for demo purposes).
    In production, the agent would actually sign and submit a Solana transaction.
    
    Returns: payment header value ready to be sent
    """
    sim_signature = f"SIM_{agent_name}_{int(datetime.utcnow().timestamp() * 1000)}"
    payment_data = {
        "scheme": "exact",
        "network": f"solana-{PAYMENT_CONFIG['network']}",
        "payload": sim_signature,
        "resource": path,
        "agent": agent_name
    }
    encoded = base64.b64encode(json.dumps(payment_data).encode()).decode()
    print(f"[x402] 🤖 Agent '{agent_name}' simulating payment for {path}")
    return encoded


def get_payment_stats() -> Dict[str, Any]:
    """Get stats about payments processed."""
    return {
        "verified_payments": len(_verified_payments),
        "config": {
            "network": PAYMENT_CONFIG["network"],
            "treasury": PAYMENT_CONFIG["treasury_wallet"],
            "prices": {
                "evaluation": f"{PAYMENT_CONFIG['price_per_evaluation']} lamports (0.001 USDC)",
                "negotiation": f"{PAYMENT_CONFIG['price_per_negotiation']} lamports (0.0005 USDC)",
                "attestation": f"{PAYMENT_CONFIG['price_per_attestation']} lamports (0.002 USDC)",
            }
        }
    }
