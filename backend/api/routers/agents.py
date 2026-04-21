from fastapi import APIRouter, BackgroundTasks, HTTPException
from ..models import WorkflowRequest, CreditCheckRequest
from ..ws_manager import manager
from ..agents import run_solana_borrower_workflow
from ..config import LENNY_WALLET_ADDRESS
import asyncio
from datetime import datetime

router = APIRouter(prefix="/api", tags=["agents"])

conversations = {}

@router.post("/workflow/start")
async def start_workflow(req: WorkflowRequest, background_tasks: BackgroundTasks):
    """Start lending workflow."""
    conversation_id = req.conversation_id or f"conv_{int(datetime.now().timestamp() * 1000000)}"
    
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    await manager.broadcast({
        "type": "workflow_started",
        "data": {
            "borrower": req.borrower_address,
            "lender": req.lender_address,
            "principal": req.principal,
            "conversation_id": conversation_id
        }
    })

    background_tasks.add_task(
        run_solana_borrower_workflow,
        borrower_pubkey=req.borrower_address,
        credit_score=req.credit_score,
        requested_amount_usdc=req.principal,
        initial_rate_offered=req.interest_rate,
        term_months=req.term_months
    )

    return {"success": True, "conversation_id": conversation_id}

@router.get("/agent/status")
async def get_agent_status():
    return {
        "status": "idle",
        "lenny": "ready",
        "luna": "ready"
    }
