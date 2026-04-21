"""
Mythos - Solana Attestation Service (SAS) Client
"""

import os
import json
import hashlib
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, asdict

from .config import (
    SOLANA_NETWORK,
    HELIUS_API_KEY,
    HELIUS_RPC_URL
)


@dataclass
class CreditAttestation:
    """On-chain credit attestation record."""
    subject_pubkey: str          # Borrower's Solana public key
    attestation_id: str          # Unique attestation identifier (PDA seed)
    credit_tier: str             # AAA, AA, A, B, C
    credit_score: int            # 300-850 range
    income_verified: bool        # Income verification status
    subject_pubkey: str
    attestation_id: str
    credit_tier: str
    credit_score: int
    income_verified: bool
    max_loan_usdc: int
    interest_rate_bps: int
    ltv_bps: int
    schema: str = "mythos-credit-v1"
    issued_at: str = ""
    expires_at: str = ""
    tx_signature: Optional[str] = None
    on_chain: bool = False

    def __post_init__(self):
        if not self.issued_at:
            self.issued_at = datetime.utcnow().isoformat()
        if not self.expires_at:
            expires = datetime.utcnow() + timedelta(days=30)
            self.expires_at = expires.isoformat()
        if not self.attestation_id:
            seed = f"{self.subject_pubkey}:{self.schema}:{self.issued_at}"
            self.attestation_id = f"att_{hashlib.sha256(seed.encode()).hexdigest()[:16]}"

    @property
    def is_expired(self) -> bool:
        return datetime.fromisoformat(self.expires_at) < datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


CREDIT_TIERS = {
    "AAA": {"min_score": 800, "rate_bps": 700,  "ltv_bps": 15000, "max_usdc": 100000_00},
    "AA":  {"min_score": 750, "rate_bps": 800,  "ltv_bps": 14000, "max_usdc": 75000_00},
    "A":   {"min_score": 700, "rate_bps": 950,  "ltv_bps": 13000, "max_usdc": 50000_00},
    "B":   {"min_score": 650, "rate_bps": 1100, "ltv_bps": 12000, "max_usdc": 25000_00},
    "C":   {"min_score": 600, "rate_bps": 1300, "ltv_bps": 11000, "max_usdc": 10000_00},
}

_attestations: Dict[str, CreditAttestation] = {}


class SASClient:
    """Client for the Solana Attestation Service."""

    def __init__(self):
        self.network = SOLANA_NETWORK
        self.helius_url = HELIUS_RPC_URL
        self.demo_mode = os.getenv("SAS_DEMO_MODE", "true").lower() == "true"
        self.schema_id = "mythos-credit-v1"
        
        print(f"[SAS] Client initialized (demo={self.demo_mode}, network={self.network})")

    def _score_to_tier(self, score: int) -> str:
        for tier, config in CREDIT_TIERS.items():
            if score >= config["min_score"]:
                return tier
        return "INELIGIBLE"

    def _compute_interest_rate(self, score: int, term_months: int) -> float:
        tier = self._score_to_tier(score)
        if tier == "INELIGIBLE":
            return 15.0

        base_bps = CREDIT_TIERS[tier]["rate_bps"]
        term_adj = max(0, (24 - term_months) // 6) * 25
        final_bps = max(base_bps - term_adj, 500)
        return final_bps / 100.0

    async def issue_attestation(
        self,
        subject_pubkey: str,
        credit_score: int,
        income_verified: bool = True
    ) -> CreditAttestation:
        print(f"\n[SAS] Issuing credit attestation...")
        
        tier = self._score_to_tier(credit_score)
        
        if tier == "INELIGIBLE":
            raise ValueError(f"Credit score {credit_score} does not qualify")

        tier_config = CREDIT_TIERS[tier]

        attestation = CreditAttestation(
            subject_pubkey=subject_pubkey,
            attestation_id="",
            credit_tier=tier,
            credit_score=credit_score,
            income_verified=income_verified,
            max_loan_usdc=tier_config["max_usdc"],
            interest_rate_bps=tier_config["rate_bps"],
            ltv_bps=tier_config["ltv_bps"],
        )

        if self.demo_mode:
            await asyncio.sleep(0.5)
            attestation.tx_signature = f"SAS_TX_{attestation.attestation_id[:20]}"
            attestation.on_chain = True
            _attestations[subject_pubkey] = attestation
            return attestation
        else:
            return await self._submit_sas_instruction(attestation)

    async def verify_attestation(
        self,
        subject_pubkey: str
    ) -> Optional[CreditAttestation]:
        attestation = _attestations.get(subject_pubkey)
        if not attestation:
            return None
        if attestation.is_expired:
            del _attestations[subject_pubkey]
            return None
        return attestation

    async def get_loan_terms(
        self,
        subject_pubkey: str,
        requested_amount_usdc: float,
        term_months: int
    ) -> Dict[str, Any]:
        attestation = await self.verify_attestation(subject_pubkey)

        if not attestation:
            return {
                "eligible": False,
                "reason": "No valid credit attestation.",
            }

        max_loan = attestation.max_loan_usdc / 100
        
        if requested_amount_usdc > max_loan:
            return {
                "eligible": False,
                "reason": f"Requested amount exceeds maximum.",
            }

        rate = self._compute_interest_rate(attestation.credit_score, term_months)

        return {
            "eligible": True,
            "tier": attestation.credit_tier,
            "interest_rate": rate,
            "interest_rate_bps": attestation.interest_rate_bps,
            "ltv_percent": attestation.ltv_bps / 100,
            "max_loan_usdc": max_loan,
            "requested_amount_usdc": requested_amount_usdc,
            "monthly_payment": self._compute_monthly_payment(requested_amount_usdc, rate, term_months),
            "attestation_id": attestation.attestation_id,
            "attestation_expires": attestation.expires_at[:10],
        }

    def _compute_monthly_payment(self, principal: float, annual_rate: float, months: int) -> float:
        if annual_rate == 0:
            return principal / months
        monthly_rate = (annual_rate / 100) / 12
        payment = principal * (monthly_rate * (1 + monthly_rate) ** months) / ((1 + monthly_rate) ** months - 1)
        return round(payment, 2)

    async def _submit_sas_instruction(self, attestation: CreditAttestation) -> CreditAttestation:
        attestation.tx_signature = "SAS_TX_PENDING_ANCHOR_INTEGRATION"
        attestation.on_chain = False
        _attestations[attestation.subject_pubkey] = attestation
        return attestation

    def list_all_attestations(self) -> list:
        return [
            {
                "subject": att.subject_pubkey[:8] + "..." + att.subject_pubkey[-4:],
                "tier": att.credit_tier,
                "rate": att.interest_rate_bps / 100,
                "expires": att.expires_at[:10],
                "on_chain": att.on_chain
            }
            for att in _attestations.values()
            if not att.is_expired
        ]


sas_client = SASClient()


"""
Mythos - x402 Payment Gate Middleware
"""

async def get_or_create_attestation(
    pubkey: str,
    credit_score: int = 720,
    income_verified: bool = True
) -> CreditAttestation:
    """Get existing attestation or create new one."""
    existing = await sas_client.verify_attestation(pubkey)
    if existing:
        return existing
    return await sas_client.issue_attestation(pubkey, credit_score, income_verified)


def mock_credit_score_from_history(wallet_address: str) -> int:
    """
    Deterministic mock credit score based on wallet address.
    For demo purposes â€” maps wallet to a repeatable credit score.
    """
    score_seed = int(hashlib.sha256(wallet_address.encode()).hexdigest()[:4], 16)
    # Map to 600-820 range
    return 600 + (score_seed % 221)

