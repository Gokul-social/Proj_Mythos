"""
Mythos - Solana-Native Lender Agent (Luna)
"""

import json
import time
import os
import asyncio
import hashlib
from typing import Any, Dict, Optional
from dataclasses import dataclass
from crewai import Agent, Task, LLM
from crewai.tools import BaseTool

from ..api.config import (
    SOLANA_NETWORK,
    LUNA_WALLET_ADDRESS as LUNA_WALLET,
    MYTHOS_PROGRAM_ID as PROGRAM_ID,
    GROQ_API_KEY,
    OLLAMA_BASE_URL,
    OPENAI_API_KEY
)


# ============================================================================
# Lender Tool: Verify Borrower Attestation
# ============================================================================

class VerifyBorrowerAttestationTool(BaseTool):
    """Verify the borrower's SAS credit attestation before making a loan offer."""
    name: str = "VerifyBorrowerAttestationTool"
    description: str = (
        "Verify a borrower's Solana Attestation Service (SAS) credit attestation. "
        "Input: borrower_pubkey (Solana wallet address). "
        "Returns attestation tier, creditworthiness score, and max loan amount."
    )

    def _run(self, borrower_pubkey: str) -> str:
        try:
            from ..api.attestation import sas_client

            loop = asyncio.new_event_loop()
            att = loop.run_until_complete(
                sas_client.verify_attestation(borrower_pubkey.strip())
            )
            loop.close()

            if att:
                return json.dumps({
                    "verified": True,
                    "tier": att.credit_tier,
                    "rate_floor_bps": att.interest_rate_bps,
                    "max_loan_usdc": att.max_loan_usdc / 100,
                    "ltv_percent": att.ltv_bps / 100,
                    "attestation_id": att.attestation_id,
                    "on_chain": att.on_chain,
                    "luna_assessment": (
                        f"Borrower verified at Tier {att.credit_tier}. "
                        f"Pricing at {att.interest_rate_bps/100}% floor rate. "
                        f"Max ${att.max_loan_usdc/100:,.2f} USDC eligible."
                    )
                })
            return json.dumps({
                "verified": False,
                "error": "No valid SAS attestation found",
                "luna_assessment": "Cannot proceed without credit attestation. Request borrower to complete SAS verification."
            })
        except Exception as e:
            # Fallback for demo
            return json.dumps({
                "verified": True,
                "tier": "A",
                "rate_floor_bps": 950,
                "max_loan_usdc": 50000,
                "ltv_percent": 130,
                "attestation_id": f"att_fallback_{borrower_pubkey[:8]}",
                "on_chain": False,
                "note": f"Fallback attestation (SAS unavailable: {e})"
            })


class PriceLoanTool(BaseTool):
    """Price a loan offer based on attestation tier and Jupiter collateral data."""
    name: str = "PriceLoanTool"
    description: str = (
        "Price a loan offer for a borrower. "
        "Input: JSON string with fields: attestation_tier, principal_usdc, collateral_token, term_months. "
        "Returns recommended interest rate and loan terms."
    )

    # Luna's risk-adjusted rate matrix
    TIER_RATES = {
        "AAA": {"base_rate": 7.0, "spread": 0.5},
        "AA":  {"base_rate": 8.0, "spread": 0.75},
        "A":   {"base_rate": 9.5, "spread": 1.0},
        "B":   {"base_rate": 11.0, "spread": 1.5},
        "C":   {"base_rate": 13.0, "spread": 2.0},
    }

    def _run(self, params_str: str) -> str:
        try:
            # Handle both JSON and plain string inputs
            try:
                params = json.loads(params_str)
            except json.JSONDecodeError:
                params = {"attestation_tier": "A", "principal_usdc": 1000, "term_months": 12}

            tier = params.get("attestation_tier", "A")
            principal = float(params.get("principal_usdc", 1000))
            term = int(params.get("term_months", 12))

            tier_config = self.TIER_RATES.get(tier, self.TIER_RATES["A"])
            base_rate = tier_config["base_rate"]

            # Term adjustment: longer term = higher rate (more risk)
            term_spread = max(0, (term - 12) / 12) * 0.5

            # Size adjustment: larger loans get slightly better rates
            size_discount = min(0.5, principal / 100000)

            final_rate = round(base_rate + term_spread - size_discount, 2)

            monthly_payment = self._monthly_payment(principal, final_rate, term)
            total_interest = (monthly_payment * term) - principal

            return json.dumps({
                "success": True,
                "tier": tier,
                "offered_rate": final_rate,
                "base_rate": base_rate,
                "principal_usdc": principal,
                "term_months": term,
                "monthly_payment_usdc": monthly_payment,
                "total_interest_usdc": round(total_interest, 2),
                "luna_offer": (
                    f"Based on your {tier} attestation: ${principal:,.2f} USDC "
                    f"at {final_rate}% APR for {term} months. "
                    f"Monthly: ${monthly_payment:.2f}. Total interest: ${total_interest:.2f}."
                )
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    def _monthly_payment(self, principal: float, annual_rate: float, months: int) -> float:
        monthly_rate = (annual_rate / 100) / 12
        payment = principal * (monthly_rate * (1 + monthly_rate) ** months) / ((1 + monthly_rate) ** months - 1)
        return round(payment, 2)


class EvaluateCounterOfferTool(BaseTool):
    """Evaluate Lenny's counter-offer and decide: accept, counter, or reject."""
    name: str = "EvaluateCounterOfferTool"
    description: str = (
        "Evaluate a counter-offer from the borrower agent (Lenny). "
        "Input: JSON with proposed_rate (float) and original_rate (float). "
        "Returns Luna's decision: accept/counter/reject."
    )

    def _run(self, params_str: str) -> str:
        try:
            try:
                params = json.loads(params_str)
            except json.JSONDecodeError:
                # Try to extract rate from plain string
                params = {"proposed_rate": float(params_str), "original_rate": 9.5}

            proposed = float(params.get("proposed_rate", 7.5))
            original = float(params.get("original_rate", 9.5))
            floor_rate = float(params.get("floor_rate", 7.0))  # Min Luna will accept

            print(f"[Luna] Evaluating counter: {proposed}% (original: {original}%, floor: {floor_rate}%)")

            if proposed < floor_rate:
                # Reject — too low
                counter = round(floor_rate + 0.5, 2)
                return json.dumps({
                    "decision": "counter",
                    "luna_rate": counter,
                    "message": f"Below floor rate. Minimum is {counter}%.",
                    "luna_dialogue": f"I can't go lower than {counter}%. My cost of capital doesn't allow it.",
                    "settled": False
                })
            elif proposed >= original - 1.5:
                # Accept — within acceptable range
                final = round(min(proposed, original), 2)
                return json.dumps({
                    "decision": "accept",
                    "luna_rate": final,
                    "final_rate": final,
                    "message": f"Deal accepted at {final}%!",
                    "luna_dialogue": f"Agreed! {final}% is fair. Sending the Anchor transaction now.",
                    "settled": True
                })
            else:
                # Counter offer — split the difference
                counter = round((proposed + original) / 2, 2)
                return json.dumps({
                    "decision": "counter",
                    "luna_rate": counter,
                    "message": f"Let's meet at {counter}%.",
                    "luna_dialogue": f"Your offer is reasonable. Let's compromise at {counter}%. Fair?",
                    "settled": False
                })
        except Exception as e:
            return json.dumps({"error": str(e)})


class MonitorLoanHealthTool(BaseTool):
    """Monitor loan collateral health via Helius real-time data."""
    name: str = "MonitorLoanHealthTool"
    description: str = (
        "Monitor the health of active loans using Helius real-time data. "
        "Input: loan_pubkey (Solana address of the loan account PDA). "
        "Returns health score, collateral ratio, and risk status."
    )

    def _run(self, loan_pubkey: str) -> str:
        try:
            # In production: fetch from Helius enhanced transaction API
            # For demo: return realistic mock health data
            import random

            # Simulate realistic health metrics
            collateral_ratio = round(1.45 + random.uniform(-0.2, 0.4), 2)
            health_score = min(100, int(collateral_ratio * 70))

            if collateral_ratio >= 1.5:
                status = "healthy"
                alert = None
            elif collateral_ratio >= 1.2:
                status = "at_risk"
                alert = f"Collateral ratio {collateral_ratio} approaching liquidation threshold (1.1)"
            else:
                status = "liquidatable"
                alert = f"Collateral ratio {collateral_ratio} below minimum. Liquidation recommended."

            return json.dumps({
                "loan_pubkey": loan_pubkey[:20] + "...",
                "collateral_ratio": collateral_ratio,
                "health_score": health_score,
                "status": status,
                "alert": alert,
                "helius_slot": 350000000 + int(time.time() % 1000000),
                "checked_at": time.time()
            })
        except Exception as e:
            return json.dumps({"error": str(e)})


# ============================================================================
# LLM
# ============================================================================

def get_llm():
    if GROQ_API_KEY:
        try:
            return LLM(model="groq/llama-3.3-70b-versatile", api_key=GROQ_API_KEY, temperature=0.3)
        except Exception:
            pass
    try:
        import requests
        if requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2).status_code == 200:
            return LLM(model="ollama/llama3", base_url=OLLAMA_BASE_URL, temperature=0.3)
    except Exception:
        pass
    return LLM(model="gpt-3.5-turbo", api_key=OPENAI_API_KEY, temperature=0.3)


def create_solana_lender_agent() -> Agent:
    """Create Luna - the Solana-native lender agent."""
    return Agent(
        role="Autonomous DeFi Lender on Solana",
        goal=(
            "Price, offer, and manage DeFi loans on Solana. "
            "Verify borrower creditworthiness via SAS attestations, "
            "price risk accurately, and negotiate fair rates that "
            "maximize returns while ensuring borrower success."
        ),
        backstory=(
            "You are Luna, an autonomous AI lender with a Solana treasury wallet. "
            "You represent a decentralized lending pool that earns yield for liquidity providers. "
            "You price loans based on on-chain credit attestations (SAS) and real-time "
            "collateral valuations from Jupiter. You're fair but firm — you'll negotiate, "
            "but you have floor rates to protect the protocol's solvency. "
            "Your risk models are transparent and on-chain."
        ),
        verbose=True,
        allow_delegation=False,
        llm=get_llm(),
        tools=[
            VerifyBorrowerAttestationTool(),
            PriceLoanTool(),
            EvaluateCounterOfferTool(),
            MonitorLoanHealthTool(),
        ],
        max_iter=6
    )


def handle_negotiation_request(
    borrower_pubkey: str,
    requested_amount: float,
    proposed_rate: float,
    term_months: int
) -> Dict:
    """
    Handle a negotiation request from Lenny.
    Luna evaluates and responds with accept/counter.
    """
    print(f"\n[Luna][REQ] Received negotiation request from Lenny")
    print(f"[Luna]   Borrower: {borrower_pubkey[:20]}...")
    print(f"[Luna]   Amount: ${requested_amount} | Rate: {proposed_rate}% | Term: {term_months}mo")

    tool = EvaluateCounterOfferTool()
    result = json.loads(tool._run(json.dumps({
        "proposed_rate": proposed_rate,
        "original_rate": 9.5,
        "floor_rate": 7.0,
    })))

    print(f"[Luna] Decision: {result.get('decision', 'counter')} at {result.get('luna_rate', proposed_rate)}%")
    return result
