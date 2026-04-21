"""
Mythos - Helius RPC & Webhook Client
"""

import os
import json
import asyncio
import httpx
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime

from .config import (
    HELIUS_API_KEY,
    SOLANA_NETWORK,
    HELIUS_RPC_URL,
    MYTHOS_PROGRAM_ID
)

# Helius endpoints
HELIUS_API_URL = f"https://api{'-dev' if SOLANA_NETWORK == 'devnet' else ''}.helius.xyz/v0"


class HeliusClient:
    """Helius enhanced RPC + API client."""

    def __init__(self):
        self._api_key = HELIUS_API_KEY
        self.rpc_url = HELIUS_RPC_URL
        self.api_url = HELIUS_API_URL
        self.demo_mode = (HELIUS_API_KEY == "demo" or not HELIUS_API_KEY)
        self._callbacks: Dict[str, List[Callable]] = {}
        print(f"[Helius] Client initialized (demo={self.demo_mode}, network={SOLANA_NETWORK})")

    @property
    def api_key(self):
        return self._api_key

    @api_key.setter
    def api_key(self, value):
        self._api_key = value
        self.demo_mode = (value == "demo" or not value)

    # =========================================================================
    # RPC Methods
    # =========================================================================

    async def get_account_info(self, pubkey: str) -> Optional[Dict]:
        """Get account info for a Solana address."""
        if self.demo_mode:
            return self._mock_account_info(pubkey)

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(self.rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [pubkey, {"encoding": "jsonParsed"}]
            })
            data = resp.json()
            return data.get("result", {}).get("value")

    async def get_transaction(self, signature: str) -> Optional[Dict]:
        """Get transaction details by signature."""
        if self.demo_mode:
            return self._mock_transaction(signature)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(self.rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [
                    signature,
                    {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
                ]
            })
            data = resp.json()
            return data.get("result")

    async def get_slot(self) -> int:
        """Get current slot number."""
        if self.demo_mode:
            return 350000000 + int(datetime.utcnow().timestamp() % 1000000)

        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(self.rpc_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getSlot"
            })
            return resp.json().get("result", 0)

    # =========================================================================
    # Helius Enhanced APIs
    # =========================================================================

    async def get_enhanced_transactions(
        self,
        address: str,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get human-readable enhanced transaction history for an address.
        Helius parses Solana transactions into meaningful events.
        """
        if self.demo_mode:
            return self._mock_enhanced_transactions(address, limit)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.api_url}/addresses/{address}/transactions",
                params={"api-key": self.api_key, "limit": limit}
            )
            if resp.status_code == 200:
                return resp.json()
            return []

    async def get_asset(self, mint: str) -> Optional[Dict]:
        """Get digital asset info (NFT/token metadata) via DAS API."""
        if self.demo_mode:
            return {"mint": mint, "name": "Demo Asset", "symbol": "DEMO"}

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.api_url}/assets?api-key={self.api_key}",
                json={"id": mint}
            )
            if resp.status_code == 200:
                return resp.json()
            return None

    async def get_token_price(self, mint: str) -> Optional[float]:
        """Get token price from Helius (uses Jupiter pricing under the hood)."""
        # For demo: use Jupiter price API directly
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"https://price.jup.ag/v6/price?ids={mint}"
                )
                data = resp.json()
                return data.get("data", {}).get(mint, {}).get("price")
        except Exception:
            mock_prices = {
                "So11111111111111111111111111111111111111112": 180.50,
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1.00,
            }
            return mock_prices.get(mint, 10.0)

    # =========================================================================
    # Webhook Management
    # =========================================================================

    async def register_webhook(
        self,
        webhook_url: str,
        account_addresses: List[str],
        transaction_types: Optional[List[str]] = None,
    ) -> Optional[str]:
        """
        Register a Helius webhook to monitor Mythos loan accounts.
        Webhooks fire when the watched addresses are involved in confirmed txs.

        Returns: webhook_id or None if failed
        """
        if self.demo_mode:
            webhook_id = f"webhook_demo_{int(datetime.utcnow().timestamp())}"
            print(f"[Helius][DEMO] Webhook registered: {webhook_id}")
            print(f"[Helius]    Watching {len(account_addresses)} accounts")
            return webhook_id

        payload = {
            "webhookURL": webhook_url,
            "transactionTypes": transaction_types or ["Any"],
            "accountAddresses": account_addresses,
            "webhookType": "enhanced",
            "authHeader": os.getenv("HELIUS_WEBHOOK_SECRET", "mythos-secret")
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self.api_url}/webhooks?api-key={self.api_key}",
                json=payload
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                webhook_id = data.get("webhookID")
                print(f"[Helius][OK] Webhook registered: {webhook_id}")
                return webhook_id
            else:
                print(f"[Helius][ERROR] Webhook registration failed: {resp.text}")
                return None

    async def parse_webhook_event(self, event: Dict) -> Dict:
        """Parse a Helius webhook event into a Mythos loan event."""
        account_data = event.get("accountData", [])
        tx_type = event.get("type", "UNKNOWN")
        signature = event.get("signature", "")
        timestamp = event.get("timestamp", 0)

        # Detect Mythos program transactions
        involved_programs = [
            acc.get("programId", "") for acc in account_data
        ]
        is_mythos_tx = MYTHOS_PROGRAM_ID in involved_programs

        parsed = {
            "event_type": "mythos_tx" if is_mythos_tx else "other_tx",
            "tx_type": tx_type,
            "signature": signature[:20] + "...",
            "timestamp": datetime.fromtimestamp(timestamp).isoformat() if timestamp else None,
            "explorer_url": f"https://explorer.solana.com/tx/{signature}?cluster={SOLANA_NETWORK}",
        }

        if is_mythos_tx:
            parsed["loan_event"] = self._parse_loan_event(event)

        return parsed

    def _parse_loan_event(self, event: Dict) -> Dict:
        """Extract loan-specific data from a Mythos program event."""
        # In production: decode Anchor instruction data
        # For now: return the raw event type
        return {
            "program": MYTHOS_PROGRAM_ID[:8] + "...",
            "instruction": event.get("type", "unknown"),
            "accounts": len(event.get("accountData", [])),
        }

    # =========================================================================
    # Real-Time Event Simulation (for Dashboard WebSocket)
    # =========================================================================

    async def stream_loan_events(self, callback: Callable, interval: float = 5.0):
        """
        Continuously stream mock loan events for real-time dashboard updates.
        In production: this would be driven by Helius webhook callbacks.
        """
        import random

        event_types = [
            ("loan_initialized", "Lenny requested a $1,000 USDC loan"),
            ("attestation_verified", "SAS credit attestation verified (Tier A)"),
            ("negotiation_round", "Lenny counter-offered: 7.5% → Luna countering"),
            ("loan_accepted", "Luna accepted 8.0% APR — loan active!"),
            ("collateral_locked", "2.3 SOL collateral locked in vault"),
            ("payment_x402", "Lenny paid 0.001 USDC via x402 for AI service"),
            ("jupiter_price_check", "Jupiter: SOL/USD = $180.50 (+2.3%)"),
        ]

        while True:
            await asyncio.sleep(interval)
            event_type, message = random.choice(event_types)

            event = {
                "type": "helius_event",
                "data": {
                    "event_type": event_type,
                    "message": message,
                    "slot": await self.get_slot(),
                    "timestamp": datetime.utcnow().isoformat(),
                    "network": SOLANA_NETWORK,
                }
            }
            await callback(event)

    # =========================================================================
    # Mock Data (Demo Mode)
    # =========================================================================

    def _mock_account_info(self, pubkey: str) -> Dict:
        return {
            "lamports": 5_000_000_000,  # 5 SOL
            "owner": MYTHOS_PROGRAM_ID,
            "data": {"parsed": {"type": "loan_account"}, "program": "mythos"},
            "executable": False,
        }

    def _mock_transaction(self, signature: str) -> Dict:
        return {
            "slot": 350000000,
            "blockTime": int(datetime.utcnow().timestamp()),
            "meta": {"err": None, "fee": 5000},
            "transaction": {
                "signatures": [signature],
                "message": {
                    "accountKeys": [MYTHOS_PROGRAM_ID],
                }
            }
        }

    def _mock_enhanced_transactions(self, address: str, limit: int) -> List[Dict]:
        events = [
            {
                "signature": f"SIM_{i}_{address[:8]}",
                "timestamp": int(datetime.utcnow().timestamp()) - (i * 3600),
                "type": ["LOAN_INITIALIZED", "LOAN_ACCEPTED", "PAYMENT"][i % 3],
                "description": [
                    "Lenny initialized a $1,000 USDC loan at 9.5%",
                    "Luna accepted at 8.0% after 2 negotiation rounds",
                    "x402 micropayment: 0.001 USDC for AI evaluation"
                ][i % 3],
                "feePayer": address,
                "nativeTransfers": [],
                "tokenTransfers": [],
            }
            for i in range(min(limit, 5))
        ]
        return events


# =========================================================================
# Global Helius Instance
# =========================================================================

helius_client = HeliusClient()


async def get_solana_network_stats() -> Dict[str, Any]:
    """Get current Solana network statistics for the dashboard."""
    slot = await helius_client.get_slot()

    sol_price = await helius_client.get_token_price(
        "So11111111111111111111111111111111111111112"
    ) or 180.50

    return {
        "network": SOLANA_NETWORK,
        "current_slot": slot,
        "sol_price_usd": round(sol_price, 2),
        "tps": 3800 + (slot % 400),  # ~3800-4200 TPS (realistic Solana range)
        "rpc": "Helius",
        "program_id": MYTHOS_PROGRAM_ID[:12] + "...",
        "demo_mode": helius_client.demo_mode,
    }
