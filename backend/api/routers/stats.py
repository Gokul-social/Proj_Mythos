from fastapi import APIRouter, HTTPException
from ..models import DashboardStats, Trade
from ..ws_manager import manager
from typing import List, Dict

router = APIRouter(prefix="/api", tags=["stats"])

# Mock state
stats_data = {
    "totalBalance": 125450.75,
    "activeLoans": 8,
    "totalProfit": 12543.50,
    "agentStatus": "idle"
}

trades_history = []

@router.get("/dashboard/stats", response_model=Dict)
async def get_stats():
    return stats_data

@router.get("/trades/history", response_model=List)
async def get_trades():
    return trades_history[:20]

@router.get("/analytics")
async def get_analytics():
    """Get analytics data for charts."""
    profit_data = []
    loans_data = []
    rates_data = []
    
    for i, trade in enumerate(trades_history[:12]):
        profit_data.append({
            "x": i,
            "y": 0,
            "value": trade.get("profit", 0) or 0,
            "label": f"Trade {i + 1}"
        })
    
    for i in range(min(10, stats_data.get("activeLoans", 0))):
        loans_data.append({
            "x": i,
            "y": 0,
            "value": 1,
            "label": f"Loan {i + 1}"
        })
    
    return {
        "profit": profit_data,
        "loans": loans_data,
        "rates": rates_data
    }
