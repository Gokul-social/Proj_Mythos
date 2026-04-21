from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# ============================================================================
# Data Models
# ============================================================================

class CreditCheckRequest(BaseModel):
    borrower_address: str
    credit_score: int  # Private - only used for ZK proof

class CreditCheckResponse(BaseModel):
    borrower_address: str
    is_eligible: bool
    proof_hash: str
    timestamp: str

class LoanOfferRequest(BaseModel):
    lender_address: str
    principal: float
    interest_rate: float
    term_months: int
    borrower_address: str

class NegotiationRequest(BaseModel):
    offer_id: str
    proposed_rate: float

class WorkflowRequest(BaseModel):
    role: Optional[str] = 'borrower'  # 'borrower' or 'lender'
    borrower_address: str
    lender_address: str
    credit_score: int
    principal: float
    interest_rate: float
    term_months: int
    stablecoin: Optional[str] = 'USDT'  # USDT, USDC, DAI, etc.
    auto_confirm: Optional[bool] = False
    conversation_id: Optional[str] = None

class WorkflowStep(BaseModel):
    step: int
    name: str
    status: str
    details: Dict
    timestamp: str

class DashboardStats(BaseModel):
    totalBalance: float
    activeLoans: int
    totalProfit: float
    agentStatus: str

class Trade(BaseModel):
    id: str
    timestamp: str
    type: str
    principal: float
    interestRate: float
    profit: Optional[float] = None
    status: str
