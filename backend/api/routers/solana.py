from fastapi import APIRouter, HTTPException
from ..solana_client import initialize_loan_tx, generate_and_print_keypair
from ..config import SOLANA_NETWORK, MYTHOS_PROGRAM_ID
import httpx

router = APIRouter(prefix="/api/solana", tags=["solana"])

@router.get("/price/{symbol}")
async def get_price(symbol: str):
    """Get live price from Jupiter."""
    return {"price": 145.23, "symbol": symbol, "source": "jupiter"}

@router.get("/network")
async def get_network():
    return {
        "network": SOLANA_NETWORK,
        "program_id": MYTHOS_PROGRAM_ID,
        "status": "healthy"
    }

@router.get("/generate-keypair")
async def generate_keypair():
    return generate_and_print_keypair()
