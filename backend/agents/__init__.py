"""
Mythos - Agents Module
AI-Native Agentic Lending on Solana
"""

try:
    from .borrower import (
        run_solana_borrower_workflow,
        create_solana_borrower_agent,
        SolanaClient,
        SolanaAttestation,
        LoanOffer,
        SolanaLoanResult,
    )
    from .lender import handle_negotiation_request
    _SOLANA_AGENTS_AVAILABLE = True
except ImportError as e:
    _SOLANA_AGENTS_AVAILABLE = False
    import warnings
    warnings.warn(f"[Mythos] Solana agents not loaded: {e}")

__all__ = [
    "run_solana_borrower_workflow",
    "create_solana_borrower_agent",
    "SolanaClient",
    "SolanaAttestation",
    "LoanOffer",
    "SolanaLoanResult",
    "handle_negotiation_request"
]
