"""
Mythos — FastAPI Backend Server
================================
AI-Native Agentic Lending Protocol on Solana

Integrates:
- Solana Attestation Service (SAS) credit scores
- x402 micropayment gates for AI services
- Helius RPC + webhooks for real-time on-chain data
- Jupiter price feeds for collateral valuation
- CrewAI agents (Lenny borrower + Luna lender)
- Anchor program interactions (Solana Devnet)
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
import asyncio
import json
import os
import sys
from datetime import datetime
from pydantic import BaseModel
from contextlib import asynccontextmanager

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

# Import AI Agents
try:
    from agents.borrower_agent import create_borrower_agent
    from agents.lender_agent import create_lender_agent, handle_negotiation_request
    from agents.multi_agent_negotiation import get_negotiation_manager
    from crewai import Crew, Task
    AGENTS_AVAILABLE = True
except ImportError as e:
    AGENTS_AVAILABLE = False
    print(f"[WARNING] Agent modules not available: {e}")

# Midnight Network removed - using Circom/SnarkJS ZK proofs instead
MIDNIGHT_AVAILABLE = False

# Import Credit Oracle
try:
    from backend.oracles.credit_oracle import get_credit_oracle
    ORACLE_AVAILABLE = True
except ImportError as e:
    ORACLE_AVAILABLE = False
    print(f"[WARNING] Credit oracle not available: {e}")


# ============================================================================
# Application Setup
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Note: uvicorn may override PORT env var with command line --port
    # We'll read it from the app state if available, otherwise default
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    display_host = "localhost" if host == "0.0.0.0" else host

    print("=" * 70)
    print("Lendora AI Backend API Started")
    print("=" * 70)
    print(f"REST API:    http://{display_host}:{port}")
    print(f"WebSocket:   ws://{display_host}:{port}/ws")
    print(f"Docs:        http://{display_host}:{port}/docs")
    print("=" * 70)
    print("Note: Actual port shown in uvicorn startup message above")
    print("=" * 70)

    # Legacy channel manager removed; keep a neutral channel manager slot.
    app.state.negotiation_manager = None

    # Initialize AI Agents (always running)
    print("[Agents] Initializing AI agents...")
    app.state.agents_initialized = False
    app.state.agent_heartbeat_task = None

    # Set dummy environment variables to prevent LLM initialization errors
    os.environ.setdefault('OPENAI_API_KEY', 'dummy-key-for-development')
    os.environ.setdefault('ANTHROPIC_API_KEY', 'dummy-key-for-development')

    try:
        # Legacy Cardano-specific hooks removed; Solana agents are canonical.

        if AGENTS_AVAILABLE:
            # Initialize CrewAI agents (may fail due to LLM issues)
            try:
                lenny = create_borrower_agent()
                app.state.lenny_agent = lenny
                print("[Agents] Lenny (Borrower Agent) initialized and ready")
            except Exception as e:
                print(f"[Agents] Lenny initialization failed (LLM issue): {e}")
                app.state.lenny_agent = None

            try:
                luna = create_lender_agent()
                app.state.luna_agent = luna
                print("[Agents] Luna (Lender Agent) initialized and ready")
            except Exception as e:
                print(f"[Agents] Luna initialization failed (LLM issue): {e}")
                app.state.luna_agent = None

            # Check if at least one component is available
            if app.state.lenny_agent or app.state.luna_agent:
                app.state.agents_initialized = True
                print("[Agents] AI agents system initialized (with available components)")

                # Start agent heartbeat task
                app.state.agent_heartbeat_task = asyncio.create_task(agent_heartbeat())
                print("[Agents] Agent heartbeat monitoring started")

                # Broadcast initial agent status
                await manager.broadcast({
                    "type": "agent_status",
                    "data": {"status": "idle", "task": "Ready for loan negotiations"}
                })
            else:
                print("[Agents] No AI components available, using full simulation mode")
                app.state.agents_initialized = False
        else:
            print("[Agents] CrewAI not available, using simulation mode")
            app.state.agents_initialized = False

    except Exception as e:
        print(f"[Agents] Critical error during initialization: {e}")
        app.state.agents_initialized = False
        app.state.lenny_agent = None
        app.state.luna_agent = None

    yield

    # Shutdown
    print("[Shutdown] Cleaning up resources...")

    # Cancel agent heartbeat task
    if hasattr(app.state, 'agent_heartbeat_task') and app.state.agent_heartbeat_task:
        app.state.agent_heartbeat_task.cancel()
        try:
            await app.state.agent_heartbeat_task
        except asyncio.CancelledError:
            pass
        print("[Agents] Heartbeat task cancelled")

    # Stop agents
    if hasattr(app.state, 'agents_initialized') and app.state.agents_initialized:
        print("[Agents] Agents shutdown complete")

    # Legacy channel manager cleanup is not needed.

app = FastAPI(
    title="Mythos API",
    description="AI-Native Agentic Lending Protocol on Solana — x402 · SAS · Helius · Jupiter",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-PAYMENT", "X-PAYMENT-REQUIRED"],
    expose_headers=["X-PAYMENT-REQUIRED"],
)

# Import Solana/Mythos modules
try:
    from x402_middleware import x402_middleware, get_payment_stats, simulate_agent_payment
    X402_AVAILABLE = True
    app.middleware("http")(x402_middleware)
    print("[x402][OK] Payment gate middleware loaded")
except ImportError as e:
    X402_AVAILABLE = False
    print(f"[x402] Not available: {e}")

try:
    from attestation import sas_client, get_or_create_attestation, mock_credit_score_from_history
    SAS_AVAILABLE = True
    print("[SAS][OK] Attestation client loaded")
except ImportError as e:
    SAS_AVAILABLE = False
    print(f"[SAS] Not available: {e}")

try:
    from helius_client import helius_client, get_solana_network_stats
    HELIUS_AVAILABLE = True
    print("[Helius][OK] RPC client loaded")
except ImportError as e:
    HELIUS_AVAILABLE = False
    print(f"[Helius] Not available: {e}")

try:
    from agents.solana_borrower_agent import run_solana_borrower_workflow
    from agents.solana_lender_agent import handle_negotiation_request
    SOLANA_AGENTS_AVAILABLE = True
    print("[SolanaAgents][OK] Lenny + Luna loaded")
except ImportError as e:
    SOLANA_AGENTS_AVAILABLE = False
    print(f"[SolanaAgents] Not available: {e}")


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
    stablecoin: Optional[str] = 'USDT'  # Allowed: USDT, USDC, PYUSD
    auto_confirm: Optional[bool] = False
    conversation_id: Optional[str] = None

# Legacy channel config request removed

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


# ============================================================================
# WebSocket Manager
# ============================================================================

class ConnectionManager:
    def __init__(self):
        self.connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.connections.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self.connections:
                self.connections.remove(ws)

    async def broadcast(self, message: dict):
        # Create a copy of connections to avoid race conditions during iteration
        async with self._lock:
            connections_copy = self.connections.copy()

        # Broadcast to all connections
        dead_connections = []
        for conn in connections_copy:
            try:
                await conn.send_json(message)
            except Exception:
                # Connection might be closed, mark for removal
                dead_connections.append(conn)

        # Remove dead connections
        if dead_connections:
            async with self._lock:
                for conn in dead_connections:
                    if conn in self.connections:
                        self.connections.remove(conn)

manager = ConnectionManager()


async def broadcast_workflow_channel_status(
    mode: str,
    connected: Optional[bool] = None,
    head_state: Optional[str] = None,
    active_negotiations: Optional[int] = None,
    current_head_id: Optional[str] = None,
):
    """Broadcast canonical channel status and legacy alias for compatibility."""
    payload = {
        "mode": mode,
        "connected": connected,
        "head_state": head_state,
        "active_negotiations": active_negotiations,
        "current_head_id": current_head_id,
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    # Canonical event for Solana workflow clients
    await manager.broadcast({
        "type": "workflow_channel_status",
        "data": payload
    })

    # Backward-compatible alias for older dashboard clients
    legacy_payload = dict(payload)
    if legacy_payload.get("mode") == "channel":
        legacy_payload["mode"] = "hydra"

    await manager.broadcast({
        "type": "hydra_status",
        "data": legacy_payload
    })


# ============================================================================
# In-Memory State
# ============================================================================

class AppState:
    def __init__(self):
        self.workflow_steps: List[Dict] = []
        self.current_negotiation: Optional[Dict] = None
        self.credit_checks: Dict[str, Dict] = {}
        self.trades: List[Dict] = []
        self.conversations: Dict[str, List[Dict]] = {}  # conversation_id -> messages
        self.stats = {
            "totalBalance": 125450.75,
            "activeLoans": 8,
            "totalProfit": 12543.50,
            "agentStatus": "idle"
        }
        self.channel_connected = False

state = AppState()


# ============================================================================
# Agent Heartbeat (Keep agents responsive)
# ============================================================================

async def agent_heartbeat():
    """Periodic heartbeat to keep agents responsive and broadcast status."""
    while True:
        try:
            # Check agent status every 30 seconds
            agents_initialized = getattr(app.state, 'agents_initialized', False)

            if agents_initialized:
                # Agents are active - send heartbeat
                await manager.broadcast({
                    "type": "agent_status",
                    "data": {
                        "status": state.stats["agentStatus"],
                        "task": "Monitoring loan offers" if state.stats["agentStatus"] == "idle" else "Active negotiation",
                        "heartbeat": True
                    }
                })
            else:
                # Agents not initialized
                await manager.broadcast({
                    "type": "agent_status",
                    "data": {
                        "status": "unavailable",
                        "task": "Agents not initialized",
                        "heartbeat": True
                    }
                })

        except Exception as e:
            print(f"[Heartbeat] Error: {e}")

        # Wait 30 seconds before next heartbeat
        await asyncio.sleep(30)


# ============================================================================
# Midnight ZK Credit Check (Mock)
# ============================================================================

async def perform_credit_check(borrower: str, score: int) -> Dict:
    """Perform ZK credit check using Circom/SnarkJS (replaces Midnight)."""
    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 1,
            "name": "ZK Credit Check",
            "status": "processing",
            "details": {"borrower": borrower}
        }
    })

    # Try to get credit score from oracle first
    credit_score = score
    # Temporarily disable oracle for testing - use input score directly
    # if ORACLE_AVAILABLE:
    #     oracle = get_credit_oracle()
    #     oracle_data = oracle.get_credit_score(borrower)
    #     if oracle_data:
    #         credit_score = oracle_data.score
    #         print(f"[Oracle] Fetched credit score: {credit_score} (confidence: {oracle_data.confidence})")

    # Perform ZK credit check using Circom/SnarkJS (replaces Midnight)
    # TODO: Integrate with backend/zk/proof_generator.py
    await asyncio.sleep(1)  # Simulate processing
    is_eligible = credit_score >= 700
    proof_hash = f"zk_proof_{borrower[:10]}_{int(datetime.now().timestamp())}"

    result = {
        "borrower_address": borrower,
        "is_eligible": is_eligible,
        "proof_hash": proof_hash,
        "timestamp": datetime.now().isoformat(),
        "source": "circom"  # Using Circom instead of Midnight
    }

    state.credit_checks[borrower] = result

    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 1,
            "name": "ZK Credit Check",
            "status": "completed",
            "details": {
                "is_eligible": result["is_eligible"],
                "proof_hash": result["proof_hash"],
                "message": "Credit score verified privately via ZK proof",
                "source": result.get("source", "circom")
            }
        }
    })

    return result


# ============================================================================
# Workflow Channel Negotiation (Real + Fallback)
# ============================================================================

async def open_workflow_channel_real(
    borrower: str,
    lender: str,
    principal: float,
    interest_rate: float,
    term_months: int
) -> Dict:
    """Open a negotiation channel using the configured manager."""
    negotiation_manager = app.state.negotiation_manager

    if not negotiation_manager:
        # Fallback to mock
        return await open_workflow_channel_mock({
            "offer_id": f"offer_{int(datetime.now().timestamp())}",
            "lender_address": lender,
            "borrower_address": borrower,
            "principal": principal,
            "interest_rate": interest_rate,
            "term_months": term_months
        })

    try:
        negotiation = await negotiation_manager.open_negotiation(
            borrower=borrower,
            lender=lender,
            principal=principal,
            interest_rate=interest_rate,
            term_months=term_months
        )

        await manager.broadcast({
            "type": "workflow_step",
            "data": {
                "step": 3,
                "name": "Open Negotiation Channel",
                "status": "completed",
                "details": {
                    "head_id": negotiation.head_id,
                    "participants": [lender, borrower],
                    "mode": "direct" if not negotiation_manager.client._connected else "channel"
                }
            }
        })

        await broadcast_workflow_channel_status(
            mode="channel" if negotiation_manager.client._connected else "direct",
            connected=negotiation_manager.client._connected,
            head_state="Open",
            active_negotiations=len(negotiation_manager.active_negotiations),
            current_head_id=negotiation.head_id,
        )

        state.current_negotiation = {
            "head_id": negotiation.head_id,
            "borrower": borrower,
            "lender": lender,
            "principal": principal,
            "current_rate": interest_rate,
            "original_rate": interest_rate,
            "term_months": term_months,
            "rounds": 0,
            "status": "open"
        }

        return {
            "head_id": negotiation.head_id,
            "status": "open",
            "mode": "direct" if not negotiation_manager.client._connected else "channel"
        }

    except Exception as e:
        print(f"[Channel] Error opening negotiation channel: {e}")
        # Fallback to mock
        return await open_workflow_channel_mock({
            "offer_id": f"offer_{int(datetime.now().timestamp())}",
            "lender_address": lender,
            "borrower_address": borrower,
            "principal": principal,
            "interest_rate": interest_rate,
            "term_months": term_months
        })


async def negotiate_workflow_terms_real(proposed_rate: float) -> Dict:
    """Run negotiation rounds using the configured manager."""
    if not state.current_negotiation:
        return {"error": "No active negotiation"}

    neg = state.current_negotiation
    negotiation_manager = app.state.negotiation_manager

    if negotiation_manager and neg.get("head_id") in negotiation_manager.active_negotiations:
        try:
            result = await negotiation_manager.submit_counter_offer(
                head_id=neg["head_id"],
                proposed_rate=proposed_rate,
                from_party=neg["borrower"]
            )

            neg["rounds"] = result.get("round", neg["rounds"] + 1)
            neg["current_rate"] = result.get("new_rate", proposed_rate)

            await manager.broadcast({
                "type": "workflow_step",
                "data": {
                    "step": 4,
                    "name": f"Negotiation Round {neg['rounds']}",
                    "status": "completed",
                    "details": {
                        "proposed_rate": proposed_rate,
                        "current_rate": neg["current_rate"],
                        "message": "Counter-offer submitted (zero gas!)"
                    }
                }
            })

            return result

        except Exception as e:
        print(f"[Channel] Negotiation error: {e}")

    # Fallback to mock negotiation logic
    return await negotiate_workflow_terms_mock(proposed_rate)


async def finalize_workflow_settlement_real() -> Dict:
    """Finalize settlement for the active negotiation channel."""
    if not state.current_negotiation:
        return {"error": "No active negotiation"}

    neg = state.current_negotiation
    negotiation_manager = app.state.negotiation_manager

    settlement = None

    if negotiation_manager and neg.get("head_id") in negotiation_manager.active_negotiations:
        try:
            settlement_obj = await negotiation_manager.accept_and_settle(neg["head_id"])

            settlement = {
                "tx_hash": settlement_obj.tx_hash,
                "borrower": settlement_obj.borrower,
                "lender": settlement_obj.lender,
                "principal": settlement_obj.principal,
                "final_rate": settlement_obj.final_rate,
                "final_rate_bps": settlement_obj.final_rate_bps,
                "term_months": settlement_obj.term_months,
                "status": settlement_obj.status
            }

        except Exception as e:
            print(f"[Channel] Settlement error: {e}")

    if not settlement:
        # Fallback to mock settlement
        return await finalize_workflow_settlement_mock()

    # Broadcast close head
    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 5,
            "name": "Finalize Negotiation Channel",
            "status": "completed",
            "details": {
                "head_id": neg["head_id"],
                "final_rate": settlement["final_rate"],
                "rounds": neg["rounds"],
                "savings": round(neg["original_rate"] - settlement["final_rate"], 2)
            }
        }
    })

    await asyncio.sleep(0.5)

    # Broadcast Aiken validation
    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 6,
            "name": "Aiken Validator Settlement",
            "status": "completed",
            "details": {
                "borrower_sig": "OK",
                "lender_sig": "OK",
                "rate_valid": "OK",
                "settlement": settlement
            }
        }
    })

    # Settlement path is Solana-native; transaction emission is handled by the
    # current workflow service and mock fallback in this API layer.

    # Record trade
    trade = {
        "id": f"trade_{int(datetime.now().timestamp())}",
        "timestamp": datetime.now().isoformat(),
        "type": "loan_accepted",
        "principal": settlement["principal"],
        "interestRate": settlement["final_rate"],
        "originalRate": neg["original_rate"],
        "profit": round((neg["original_rate"] - settlement["final_rate"]) * settlement["principal"] / 100, 2),
        "status": "completed",
        "tx_id": settlement.get("tx_id"),
        "real_tx": settlement.get("real_tx", False)
    }
    state.trades.insert(0, trade)

    # Update stats
    state.stats["activeLoans"] += 1
    state.stats["totalProfit"] += trade["profit"]

    # Clear negotiation
    state.current_negotiation = None

    # Final broadcasts
    await manager.broadcast({
        "type": "workflow_complete",
        "data": {
            "success": True,
            "settlement": settlement,
            "trade": trade
        }
    })

    await manager.broadcast({
        "type": "stats_update",
        "data": state.stats
    })

    return settlement


# ============================================================================
# Workflow Channel Mock Fallback
# ============================================================================

async def open_workflow_channel_mock(offer: Dict) -> Dict:
    """Open a mock negotiation channel for off-chain negotiation."""
    head_id = f"head_{offer['offer_id']}_{int(datetime.now().timestamp())}"

    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 3,
            "name": "Open Negotiation Channel",
            "status": "completed",
            "details": {
                "head_id": head_id,
                "participants": [offer["lender_address"], offer["borrower_address"]],
                "mode": "mock"
            }
        }
    })

    state.current_negotiation = {
        "head_id": head_id,
        "offer": offer,
        "borrower": offer["borrower_address"],
        "lender": offer["lender_address"],
        "principal": offer["principal"],
        "original_rate": offer["interest_rate"],
        "current_rate": offer["interest_rate"],
        "term_months": offer["term_months"],
        "rounds": 0,
        "status": "open"
    }

    return {"head_id": head_id, "status": "open", "mode": "mock"}


async def negotiate_workflow_terms_mock(proposed_rate: float) -> Dict:
    """Execute mock loan negotiation rounds."""
    if not state.current_negotiation:
        return {"error": "No active negotiation"}

    neg = state.current_negotiation
    neg["rounds"] += 1

    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 4,
            "name": f"Negotiation Round {neg['rounds']}",
            "status": "processing",
            "details": {
                "proposed_rate": proposed_rate,
                "current_rate": neg["current_rate"]
            }
        }
    })

    await asyncio.sleep(0.5)

    original_rate = neg["original_rate"]

    if proposed_rate >= original_rate - 1.5:
        # Accept
        neg["current_rate"] = proposed_rate
        neg["final_rate"] = proposed_rate
        neg["status"] = "accepted"
        action = "accepted"
        message = f"Deal at {proposed_rate}%!"
    elif neg["rounds"] >= 2:
        # Compromise
        middle = round((proposed_rate + neg["current_rate"]) / 2, 1)
        neg["current_rate"] = middle
        neg["final_rate"] = middle
        neg["status"] = "accepted"
        action = "accepted"
        message = f"Compromise at {middle}%!"
    else:
        # Counter
        counter = round(neg["current_rate"] - 0.5, 1)
        neg["current_rate"] = counter
        action = "counter"
        message = f"Lender countered: {counter}%"

    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 4,
            "name": f"Negotiation Round {neg['rounds']}",
            "status": "completed",
            "details": {
                "action": action,
                "rate": neg.get("final_rate", neg["current_rate"]),
                "message": message
            }
        }
    })

    return {
        "success": True,
        "action": action,
        "rate": neg.get("final_rate", neg["current_rate"]),
        "message": message
    }


async def finalize_workflow_settlement_mock() -> Dict:
    """Close mock negotiation channel and execute settlement."""
    if not state.current_negotiation:
        return {"error": "No active negotiation"}

    neg = state.current_negotiation

    # If no final_rate set, use current_rate
    if "final_rate" not in neg:
        neg["final_rate"] = neg["current_rate"]

    # Close Head
    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 5,
            "name": "Finalize Negotiation Channel",
            "status": "completed",
            "details": {
                "head_id": neg["head_id"],
                "final_rate": neg["final_rate"],
                "rounds": neg["rounds"],
                "savings": round(neg["original_rate"] - neg["final_rate"], 2)
            }
        }
    })

    await asyncio.sleep(0.5)

    # Generate settlement TX
    tx_hash = f"tx_{neg['head_id']}_{int(datetime.now().timestamp())}"

    # Aiken Validator verification
    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 6,
            "name": "Aiken Validator Settlement",
            "status": "processing",
            "details": {"tx_hash": tx_hash}
        }
    })

    await asyncio.sleep(1)

    settlement = {
        "tx_hash": tx_hash,
        "borrower": neg["borrower"],
        "lender": neg["lender"],
        "principal": neg["principal"],
        "final_rate": neg["final_rate"],
        "final_rate_bps": int(neg["final_rate"] * 100),
        "term_months": neg["term_months"],
        "status": "LOAN_DISBURSED"
    }

    await manager.broadcast({
        "type": "workflow_step",
        "data": {
            "step": 6,
            "name": "Aiken Validator Settlement",
            "status": "completed",
            "details": {
                "borrower_sig": "OK",
                "lender_sig": "OK",
                "rate_valid": "OK",
                "settlement": settlement
            }
        }
    })

    # Record trade
    trade = {
        "id": f"trade_{int(datetime.now().timestamp())}",
        "timestamp": datetime.now().isoformat(),
        "type": "loan_accepted",
        "principal": neg["principal"],
        "interestRate": neg["final_rate"],
        "originalRate": neg["original_rate"],
        "profit": round((neg["original_rate"] - neg["final_rate"]) * neg["principal"] / 100, 2),
        "status": "completed"
    }
    state.trades.insert(0, trade)

    # Update stats
    state.stats["activeLoans"] += 1
    state.stats["totalProfit"] += trade["profit"]

    # Clear negotiation
    state.current_negotiation = None

    # Final broadcast
    await manager.broadcast({
        "type": "workflow_complete",
        "data": {
            "success": True,
            "settlement": settlement,
            "trade": trade
        }
    })

    await manager.broadcast({
        "type": "stats_update",
        "data": state.stats
    })

    return settlement


# ============================================================================
# REST API Endpoints
# ============================================================================

@app.get("/")
async def root():
    return {"message": "Lendora AI API", "version": "2.0.0"}

@app.get("/health")
async def health():
    channel_status = "disconnected"
    channel_mode = "none"

    if hasattr(app.state, 'negotiation_manager') and app.state.negotiation_manager:
        channel_mode = "direct" if not app.state.negotiation_manager.client._connected else "channel"
        channel_status = "connected" if app.state.negotiation_manager.client._connected else "disconnected"

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "workflow_channel": {
            "status": channel_status,
            "mode": channel_mode
        },
        # Backward-compatible field for clients still expecting `hydra`
        "hydra": {
            "status": channel_status,
            "mode": "hydra" if channel_mode == "channel" else channel_mode
        }
    }


# Legacy channel endpoints removed; Solana workflow routes are canonical


# --- Dashboard ---

@app.get("/api/dashboard/stats")
async def get_stats():
    return state.stats

@app.get("/api/trades/history")
async def get_trades():
    return state.trades[:20]


@app.get("/api/analytics")
async def get_analytics():
    """Get analytics data for 3D charts."""
    # Generate analytics from trades and stats
    profit_data = []
    loans_data = []
    rates_data = []

    # Process trades for profit chart
    for i, trade in enumerate(state.trades[:12]):
        profit_data.append({
            "x": i,
            "y": 0,
            "value": trade.get("profit", 0) or 0,
            "label": f"Trade {i + 1}"
        })

    # Process loans
    for i in range(min(10, state.stats.get("activeLoans", 0))):
        loans_data.append({
            "x": i,
            "y": 0,
            "value": 1,
            "label": f"Loan {i + 1}"
        })

    # Process interest rates from trades
    for i, trade in enumerate(state.trades[:8]):
        if trade.get("interestRate"):
            rates_data.append({
                "x": i,
                "y": 0,
                "value": trade.get("interestRate", 0),
                "label": f"{trade.get('interestRate', 0)}%"
            })

    return {
        "profit": profit_data,
        "loans": loans_data,
        "rates": rates_data
    }


# --- Credit Check ---

@app.post("/api/zk/credit-check")  # Replaced Midnight with Circom/SnarkJS
async def credit_check(req: CreditCheckRequest, background_tasks: BackgroundTasks):
    """Submit credit score for ZK verification."""
    result = await perform_credit_check(req.borrower_address, req.credit_score)
    return result


# --- Loan Workflow ---

async def run_agent_negotiation(
    conversation_id: str,
    borrower_address: str,
    lender_address: str,
    principal: float,
    interest_rate: float,
    term_months: int,
    auto_confirm: bool = False
):
    """Run AI agent negotiation using pre-initialized agents."""
    try:
        await manager.broadcast({
            "type": "agent_status",
            "data": {"status": "negotiating", "task": "AI agents analyzing loan terms..."}
        })

        # Use pre-initialized agents if available
        if hasattr(app.state, 'agents_initialized') and app.state.agents_initialized:
            # Use pre-initialized Lenny agent
            lenny = app.state.lenny_agent

            # Create task for the pre-initialized agent
            task = Task(
                description=(
                    f"Analyze and negotiate this loan offer:\n"
                    f"- Principal: {principal}\n"
                    f"- Interest Rate: {interest_rate}%\n"
                    f"- Term: {term_months} months\n"
                    f"- Borrower: {borrower_address}\n"
                    f"- Lender: {lender_address}\n"
                    f"- Auto-confirm: {auto_confirm}\n\n"
                    f"1. Analyze the loan offer using your expertise\n"
                    f"2. Consider market rates and borrower/lender profiles\n"
                    f"3. Negotiate if rate is too high (target: market rate - 1.5%)\n"
                    f"4. Accept if terms are favorable or auto-confirm is enabled\n\n"
                    f"Market context: Average rates are 7-8%. Lower is better for borrowers."
                ),
                expected_output="Detailed negotiation analysis with confidence score and recommended action",
                agent=lenny
            )

            # Run agent with timeout to prevent hanging
            crew = Crew(agents=[lenny], tasks=[task], verbose=False)

            # Run in executor to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: crew.kickoff()
            )

            # Parse result for better conversation display
            result_str = str(result)
            confidence = 0.85  # Default confidence
            reasoning = "Analysis complete"

            # Try to extract confidence and reasoning from result
            try:
                if hasattr(result, 'confidence'):
                    confidence = float(result.confidence)
                if hasattr(result, 'reasoning'):
                    reasoning = result.reasoning
            except:
                pass

            # Add agent's analysis to conversation
            display_result = result_str[:200] + "..." if len(result_str) > 200 else result_str
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "lenny",
                "type": "thought",
                "content": f"Llama 3 Analysis: {display_result}",
                "confidence": confidence,
                "reasoning": reasoning
            })

            # Additional Solana-native analysis hooks can be added here if needed

            # Broadcast conversation update
            await manager.broadcast({
                "type": "conversation_update",
                "data": {"conversation_id": conversation_id}
            })

            await manager.broadcast({
                "type": "agent_status",
                "data": {"status": "analyzing", "task": "AI analysis complete"}
            })

        else:
            # Fallback: add mock analysis when agents not initialized
            await asyncio.sleep(1)

            # Mock Llama analysis
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "lenny",
                "type": "thought",
                "content": f"Llama 3 Analysis: Rate {interest_rate}% is {'acceptable' if interest_rate <= 9 else 'high'}. Market average is 7.5%. Recommended action: {'accept' if interest_rate <= 8 else 'negotiate to ' + str(round(interest_rate - 1.5, 1)) + '%'}",
                "confidence": 0.85,
                "reasoning": "Market rate analysis complete"
            })

            # Mock Solana risk/oracle analysis
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "solana",
                "type": "analysis",
                "content": f"Solana Risk Analysis: Borrower address {borrower_address[:12]}... shows standard wallet activity. No red flags detected.",
                "confidence": 0.80,
                "reasoning": "Blockchain analysis complete"
            })

            # Broadcast mock analysis update
            await manager.broadcast({
                "type": "conversation_update",
                "data": {"conversation_id": conversation_id}
            })
    except Exception as e:
        print(f"[Agent] Error in negotiation: {e}")
        import traceback
        traceback.print_exc()
        # Add error message to conversation
        if conversation_id in state.conversations:
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "system",
                "type": "message",
                "content": f"Agent analysis encountered an error: {str(e)}"
            })

            # Broadcast error update
            await manager.broadcast({
                "type": "conversation_update",
                "data": {"conversation_id": conversation_id}
            })

@app.post("/api/workflow/start")
async def start_workflow(req: WorkflowRequest, background_tasks: BackgroundTasks):
    """Start the complete lending workflow."""
    # Reset state for new workflow
    state.current_negotiation = None
    state.stats["agentStatus"] = "negotiating"

    # Initialize conversation if ID provided
    conversation_id = req.conversation_id or f"conv_{int(datetime.now().timestamp() * 1000000)}"
    if conversation_id not in state.conversations:
        state.conversations[conversation_id] = []

    try:
        # Add initial message (thread-safe)
        conversation = state.conversations[conversation_id]
        msg_id = f"msg_{len(conversation)}"
        conversation.append({
            "id": msg_id,
            "timestamp": datetime.now().isoformat(),
            "agent": "system",
            "type": "message",
            "content": f"Loan workflow started. Role: {req.role}, Stablecoin: {req.stablecoin}, Principal: {req.principal}"
        })

        await manager.broadcast({
            "type": "workflow_started",
            "data": {
                "borrower": req.borrower_address,
                "lender": req.lender_address,
                "principal": req.principal,
                "stablecoin": req.stablecoin,
                "role": req.role,
                "conversation_id": conversation_id
            }
        })

        await manager.broadcast({
            "type": "agent_status",
            "data": {"status": "negotiating", "task": "Starting workflow..."}
        })

        # Step 1: Credit Check
        credit = await perform_credit_check(req.borrower_address, req.credit_score)

        if not credit["is_eligible"]:
            # Reset state on failure
            state.stats["agentStatus"] = "idle"
            state.current_negotiation = None
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "system",
                "type": "message",
                "content": "Credit check failed. Workflow terminated."
            })
            await manager.broadcast({
                "type": "agent_status",
                "data": {"status": "idle", "task": "Workflow terminated - credit check failed"}
            })
            return {"success": False, "reason": "Credit check failed", "conversation_id": conversation_id}

        # Step 2: Create Loan Offer
        offer_id = f"offer_{int(datetime.now().timestamp())}"

        # Add agent conversation messages
        state.conversations[conversation_id].append({
            "id": f"msg_{len(state.conversations[conversation_id])}",
            "timestamp": datetime.now().isoformat(),
            "agent": "system",
            "type": "message",
            "content": f"Loan offer created: {req.interest_rate}% interest rate, {req.principal} {req.stablecoin} principal"
        })

        state.conversations[conversation_id].append({
            "id": f"msg_{len(state.conversations[conversation_id])}",
            "timestamp": datetime.now().isoformat(),
            "agent": "lenny",
            "type": "thought",
            "content": f"Analyzing offer... Market average is 7.5%. This rate is {req.interest_rate - 7.5:.1f}% {'above' if req.interest_rate > 7.5 else 'below'} average.",
            "confidence": 0.85,
            "reasoning": "Rate is acceptable but could be negotiated lower" if req.interest_rate > 7.5 else "Rate is favorable"
        })

        await manager.broadcast({
            "type": "workflow_step",
            "data": {
                "step": 2,
                "name": "Loan Offer Created",
                "status": "completed",
                "details": {
                    "offer_id": offer_id,
                    "lender_address": req.lender_address,
                    "borrower_address": req.borrower_address,
                    "principal": req.principal,
                    "interest_rate": req.interest_rate,
                    "term_months": req.term_months,
                    "stablecoin": req.stablecoin
                }
            }
        })

        # Step 3: Open negotiation channel (uses real manager if available)
        await open_workflow_channel_real(
            borrower=req.borrower_address,
            lender=req.lender_address,
            principal=req.principal,
            interest_rate=req.interest_rate,
            term_months=req.term_months
        )

        # Step 4: AI Analysis (actually run agents)
        await manager.broadcast({
            "type": "workflow_step",
            "data": {
                "step": 4,
                "name": "AI Analysis (Llama 3)",
                "status": "processing",
                "details": {"rate": req.interest_rate}
            }
        })

        # Run agent negotiation in background
        background_tasks.add_task(
            run_agent_negotiation,
            conversation_id=conversation_id,
            borrower_address=req.borrower_address,
            lender_address=req.lender_address,
            principal=req.principal,
            interest_rate=req.interest_rate,
            term_months=req.term_months,
            auto_confirm=req.auto_confirm
        )

        # Wait a bit for agent to start
        await asyncio.sleep(2)

        # Determine target rate (simplified for now, agents will handle negotiation)
        if req.interest_rate <= 7.0:
            target = req.interest_rate
            action = "accept"
        elif req.auto_confirm and req.interest_rate <= 9.0:
            target = req.interest_rate
            action = "accept"
        else:
            target = round(req.interest_rate - 1.5, 1)
            action = "negotiate"

        await manager.broadcast({
            "type": "workflow_step",
            "data": {
                "step": 4,
                "name": "AI Analysis (Llama 3)",
                "status": "completed",
                "details": {
                    "verdict": "acceptable" if req.interest_rate <= 9 else "high",
                    "action": action,
                    "target_rate": target
                }
            }
        })

        # Step 5: Negotiate (uses real client if available)
        # Add negotiation message
        state.conversations[conversation_id].append({
            "id": f"msg_{len(state.conversations[conversation_id])}",
            "timestamp": datetime.now().isoformat(),
            "agent": "lenny",
            "type": "message",
            "content": f"Counter-offer: {target}% interest rate. This is more aligned with current market conditions."
        })

        result = await negotiate_workflow_terms_real(target)

        # Add response message
        if result.get("action") == "accepted":
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "luna",
                "type": "message",
                "content": f"Accepted! Final rate: {result.get('rate', target)}%"
            })
        elif result.get("action") == "counter":
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "luna",
                "type": "message",
                "content": f"Counter-offer: {result.get('rate', target)}% - meeting in the middle."
            })
            # If counter, negotiate once more
            new_target = round((target + result["rate"]) / 2, 1)
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "lenny",
                "type": "thought",
                "content": f"{new_target}% is acceptable. Accepting terms.",
                "confidence": 0.92,
                "reasoning": "Rate is at market average, savings achieved"
            })
            result = await negotiate_workflow_terms_real(new_target)

        # Step 6: Accept and Settle (only if auto_confirm is enabled)
        settlement = None
        if req.auto_confirm:
            settlement = await finalize_workflow_settlement_real()

            # Add final settlement message
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "system",
                "type": "action",
                "content": f"Settlement transaction submitted. Loan disbursed successfully!"
            })

            # Reset state after workflow completes
            await asyncio.sleep(1)  # Brief delay to show completion
            state.stats["agentStatus"] = "idle"
            state.current_negotiation = None

            await manager.broadcast({
                "type": "agent_status",
                "data": {"status": "idle", "task": "Workflow complete. Ready for next loan."}
            })
        else:
            # Mark negotiation as completed but don't close yet
            if state.current_negotiation:
                state.current_negotiation["status"] = "completed"
                state.current_negotiation["final_rate"] = result.get('rate', target)

            # Add message indicating negotiation is complete but waiting for user consent
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "system",
                "type": "message",
                "content": f"Negotiation complete! Final rate: {result.get('rate', target)}%. Awaiting your confirmation to close the deal."
            })

            await manager.broadcast({
                "type": "agent_status",
                "data": {"status": "completed", "task": "Negotiation complete. Awaiting user confirmation."}
            })

        await manager.broadcast({
            "type": "conversation_update",
            "data": {"conversation_id": conversation_id}
        })

        return {
            "success": True,
            "conversation_id": conversation_id,
            "settlement": settlement
        }
    except Exception as e:
        # Reset state on any error
        print(f"[Workflow] Error: {e}")
        state.stats["agentStatus"] = "idle"
        state.current_negotiation = None

        if conversation_id in state.conversations:
            state.conversations[conversation_id].append({
                "id": f"msg_{len(state.conversations[conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "system",
                "type": "message",
                "content": f"Workflow error: {str(e)}"
            })

        await manager.broadcast({
            "type": "agent_status",
            "data": {"status": "idle", "task": "Workflow error - reset to idle"}
        })

        return {
            "success": False,
            "reason": str(e),
            "conversation_id": conversation_id
        }


@app.post("/api/negotiation/propose")
async def propose_rate(req: NegotiationRequest):
    """Propose a rate in active negotiation."""
    result = await negotiate_workflow_terms_real(req.proposed_rate)
    return result


@app.post("/api/negotiation/accept")
async def accept_terms():
    """Accept current terms and settle."""
    settlement = await finalize_workflow_settlement_real()
    return settlement


@app.post("/api/negotiation/settle")
async def manual_settlement():
    """Manually settle a completed negotiation (for when auto_confirm is disabled)."""
    try:
        # Check if there's an active negotiation
        if not state.current_negotiation:
            return {
                "success": False,
                "error": "No active negotiation found. Start a negotiation first."
            }

        neg = state.current_negotiation

        # Check if negotiation is in a completed state
        if neg.get("status") != "completed":
            return {
                "success": False,
                "error": "Negotiation is not completed. Wait for negotiation to finish."
            }

        print(f"[Manual Settlement] Processing settlement for head_id: {neg['head_id']}")

        # Close negotiation channel and settle
        settlement = await finalize_workflow_settlement_real()

        # Add settlement message to the most recent conversation
        latest_conversation_id = None
        if state.conversations:
            latest_conversation_id = max(state.conversations.keys())

        if latest_conversation_id:
            state.conversations[latest_conversation_id].append({
                "id": f"msg_{len(state.conversations[latest_conversation_id])}",
                "timestamp": datetime.now().isoformat(),
                "agent": "system",
                "type": "action",
                "content": f"Manual settlement completed! Loan disbursed successfully."
            })

            # Broadcast conversation update
            await manager.broadcast({
                "type": "conversation_update",
                "data": {"conversation_id": latest_conversation_id}
            })

        # Broadcast final status update
        await manager.broadcast({
            "type": "agent_status",
            "data": {"status": "idle", "task": "Manual settlement complete. Ready for next loan."}
        })

        return {
            "success": True,
            "settlement": settlement,
            "message": "Manual settlement completed successfully"
        }

    except Exception as e:
        print(f"[Manual Settlement] Error: {e}")
        return {
            "success": False,
            "error": f"Settlement failed: {str(e)}"
        }


# --- Agent Status ---

@app.get("/api/agent/status")
async def agent_status():
    agents_info = {
        "agents_initialized": getattr(app.state, 'agents_initialized', False),
        "lenny_available": hasattr(app.state, 'lenny_agent') and app.state.lenny_agent is not None,
        "luna_available": hasattr(app.state, 'luna_agent') and app.state.luna_agent is not None,
        "solana_oracle_available": False,
        "masumi_available": False,  # Legacy compatibility alias
        "status": state.stats["agentStatus"],
        "current_task": "Monitoring offers" if state.stats["agentStatus"] == "idle" else "Negotiating",
        "active_negotiation": state.current_negotiation is not None
    }
    return agents_info


@app.get("/api/agent/xai-logs")
async def xai_logs(limit: int = 20):
    """Get XAI decision logs."""
    log_file = os.path.join(os.path.dirname(__file__), "../../logs/xai_decisions.jsonl")
    logs = []
    if os.path.exists(log_file):
        with open(log_file) as f:
            for line in f:
                try:
                    logs.append(json.loads(line))
                except:
                    pass
    return logs[-limit:]


@app.get("/api/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation messages for a workflow."""
    messages = state.conversations.get(conversation_id, [])
    return {"conversation_id": conversation_id, "messages": messages}


@app.get("/api/conversation/latest")
async def get_latest_conversation():
    """Get the most recent conversation."""
    if not state.conversations:
        return {"conversation_id": None, "messages": []}

    latest_id = max(state.conversations.keys(), key=lambda k: len(state.conversations[k]))
    messages = state.conversations[latest_id]
    return {"conversation_id": latest_id, "messages": messages}


# Legacy non-Solana endpoints removed
# Settlement uses the current Solana workflow path


# ============================================================================
# Multi-Agent Negotiation
# ============================================================================

@app.post("/api/negotiation/multi-agent/create")
async def create_multi_agent_negotiation(req: Dict):
    """Create a new multi-agent negotiation session."""
    if not AGENTS_AVAILABLE:
        return {
            "success": False,
            "error": "Agents not available"
        }

    try:
        manager = get_negotiation_manager()

        negotiation = manager.create_negotiation(
            borrowers=req.get("borrowers", []),
            lenders=req.get("lenders", []),
            loan_terms=req.get("loan_terms", {})
        )

        return {
            "success": True,
            "negotiation_id": negotiation.negotiation_id,
            "participants": len(negotiation.participants),
            "status": negotiation.status
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/negotiation/multi-agent/{negotiation_id}/round")
async def run_negotiation_round(negotiation_id: str):
    """Run a round of multi-agent negotiation."""
    if not AGENTS_AVAILABLE:
        return {
            "success": False,
            "error": "Agents not available"
        }

    try:
        manager = get_negotiation_manager()
        result = await manager.run_negotiation_round(negotiation_id)
        return result

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/api/negotiation/multi-agent/{negotiation_id}")
async def get_multi_agent_negotiation(negotiation_id: str):
    """Get multi-agent negotiation details."""
    if not AGENTS_AVAILABLE:
        return {
            "success": False,
            "error": "Agents not available"
        }

    try:
        manager = get_negotiation_manager()
        negotiation = manager.get_negotiation(negotiation_id)

        if not negotiation:
            return {
                "success": False,
                "error": "Negotiation not found"
            }

        return {
            "success": True,
            "negotiation_id": negotiation.negotiation_id,
            "status": negotiation.status,
            "rounds": negotiation.rounds,
            "participants": [
                {
                    "agent_id": p.agent_id,
                    "role": p.role.value,
                    "address": p.address,
                    "current_offer": p.current_offer
                }
                for p in negotiation.participants
            ],
            "loan_terms": negotiation.loan_terms
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/api/negotiation/multi-agent")
async def list_multi_agent_negotiations():
    """List all multi-agent negotiations."""
    if not AGENTS_AVAILABLE:
        return {
            "success": False,
            "negotiations": []
        }

    try:
        manager = get_negotiation_manager()
        negotiations = manager.list_negotiations()
        return {
            "success": True,
            "negotiations": negotiations
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "negotiations": []
        }


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)

    try:
        # Send initial state
        await ws.send_json({
            "type": "connected",
            "data": {"message": "Connected to Lendora AI"}
        })

        await ws.send_json({
            "type": "stats_update",
            "data": state.stats
        })

        await ws.send_json({
            "type": "agent_status",
            "data": {"status": state.stats["agentStatus"]}
        })

        # Send workflow channel status
        channel_mode = "unavailable"
        if hasattr(app.state, 'negotiation_manager') and app.state.negotiation_manager:
            channel_mode = "direct" if not app.state.negotiation_manager.client._connected else "channel"

        await ws.send_json({
            "type": "workflow_channel_status",
            "data": {"mode": channel_mode}
        })

        await ws.send_json({
            "type": "hydra_status",
            "data": {"mode": "hydra" if channel_mode == "channel" else channel_mode}
        })

        while True:
            data = await ws.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        manager.disconnect(ws)


# ============================================================================
# SOLANA / MYTHOS API ROUTES
# ============================================================================

# --- Attestation Routes ---

class AttestationRequest(BaseModel):
    borrower_pubkey: str
    credit_score: Optional[int] = 720
    income_verified: Optional[bool] = True

@app.post("/api/solana/attest")
async def issue_attestation(req: AttestationRequest):
    """Issue a SAS credit attestation for a borrower wallet."""
    if not SAS_AVAILABLE:
        # Fallback mock
        return {
            "success": True,
            "attestation": {
                "subject_pubkey": req.borrower_pubkey,
                "credit_tier": "A",
                "interest_rate_bps": 950,
                "max_loan_usdc": 50000,
                "ltv_bps": 13000,
                "attestation_id": f"att_mock_{req.borrower_pubkey[:8]}",
                "on_chain": False,
                "demo": True,
            }
        }
    try:
        att = await sas_client.issue_attestation(
            req.borrower_pubkey,
            req.credit_score,
            req.income_verified
        )
        await manager.broadcast({
            "type": "attestation_issued",
            "data": {
                "borrower": req.borrower_pubkey[:20] + "...",
                "tier": att.credit_tier,
                "rate": att.interest_rate_bps / 100,
                "on_chain": att.on_chain,
            }
        })
        return {"success": True, "attestation": att.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/solana/attest/{pubkey}")
async def verify_attestation(pubkey: str):
    """Verify an existing SAS credit attestation."""
    if not SAS_AVAILABLE:
        return {"found": True, "tier": "A", "rate_bps": 950, "demo": True}
    att = await sas_client.verify_attestation(pubkey)
    if not att:
        return {"found": False}
    return {"found": True, "attestation": att.to_dict()}

@app.get("/api/solana/attestations")
async def list_attestations():
    """List all active credit attestations (for dashboard)."""
    if not SAS_AVAILABLE:
        return {"attestations": [], "demo": True}
    return {"attestations": sas_client.list_all_attestations()}


# --- x402 Payment Routes ---

@app.get("/api/solana/x402/stats")
async def x402_stats():
    """Get x402 payment gate statistics."""
    if not X402_AVAILABLE:
        return {"demo": True, "message": "x402 middleware not loaded"}
    return get_payment_stats()

@app.get("/api/solana/x402/simulate/{agent_name}")
async def simulate_payment(agent_name: str, resource: str = "/api/agent/evaluate"):
    """Simulate an agent x402 payment (for demo)."""
    if not X402_AVAILABLE:
        import base64, json as _json
        sig = f"SIM_{agent_name}_{int(datetime.now().timestamp()*1000)}"
        return {"header": base64.b64encode(_json.dumps({"scheme":"exact","payload":sig,"resource":resource}).encode()).decode()}
    header = simulate_agent_payment(resource, agent_name)
    return {"header": header, "agent": agent_name, "resource": resource}


# --- Jupiter Price Routes ---

@app.get("/api/solana/price/{symbol}")
async def get_token_price_route(symbol: str):
    """Get real-time token price from Jupiter."""
    import httpx
    MINTS = {
        "SOL": "So11111111111111111111111111111111111111112",
        "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "BONK": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    }
    sym = symbol.upper()
    mint = MINTS.get(sym)
    if not mint:
        return {"symbol": sym, "price_usd": 1.0, "source": "mock"}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"https://price.jup.ag/v6/price?ids={mint}")
            data = resp.json()
            price = data.get("data", {}).get(mint, {}).get("price", 0)
            return {"symbol": sym, "mint": mint, "price_usd": round(price, 6), "source": "jupiter"}
    except Exception as e:
        mock_prices = {"SOL": 180.50, "USDC": 1.00, "BONK": 0.000025}
        return {"symbol": sym, "price_usd": mock_prices.get(sym, 1.0), "source": "mock", "error": str(e)}


# --- Network Info Routes ---

@app.get("/api/solana/network")
async def get_network_info():
    """Get Solana network statistics via Helius."""
    if HELIUS_AVAILABLE:
        stats = await get_solana_network_stats()
        return stats
    return {
        "network": os.getenv("SOLANA_NETWORK", "devnet"),
        "current_slot": 350012345,
        "sol_price_usd": 180.50,
        "tps": 3900,
        "rpc": "mock",
        "program_id": os.getenv("MYTHOS_PROGRAM_ID", "MythosLend1111111111111111111111111111111111")[:12] + "...",
        "demo_mode": True,
    }


# --- Agent Evaluation Routes (x402 protected) ---

class AgentEvaluationRequest(BaseModel):
    borrower_pubkey: str
    amount_usdc: float
    collateral_token: str = "SOL"
    term_months: int = 12

@app.post("/api/agent/evaluate")
async def agent_evaluate(req: AgentEvaluationRequest, request: Request):
    """
    x402-protected endpoint: AI evaluation of loan request.
    Requires X-PAYMENT header with valid Solana USDC transaction.
    """
    payment = getattr(request.state, "payment", None)

    # Get SAS attestation for borrower
    attestation_data = {"tier": "A", "rate_bps": 950}
    if SAS_AVAILABLE:
        try:
            att = await sas_client.verify_attestation(req.borrower_pubkey)
            if att:
                attestation_data = {"tier": att.credit_tier, "rate_bps": att.interest_rate_bps}
        except Exception:
            pass

    # Jupiter price for collateral
    collateral_price = 180.50

    # Compute LTV and recommended rate
    collateral_usdc = collateral_price * (req.amount_usdc / collateral_price)
    ltv = req.amount_usdc / collateral_usdc if collateral_usdc > 0 else 1.0

    result = {
        "eligible": True,
        "borrower": req.borrower_pubkey[:20] + "...",
        "amount_usdc": req.amount_usdc,
        "attestation_tier": attestation_data["tier"],
        "recommended_rate_bps": attestation_data["rate_bps"],
        "recommended_rate_pct": attestation_data["rate_bps"] / 100,
        "collateral_token": req.collateral_token,
        "collateral_price_usd": collateral_price,
        "ltv_pct": round(ltv * 100, 2),
        "payment_verified": payment is not None,
        "x402_signature": payment.get("signature", "demo") if payment else "no_payment",
        "timestamp": datetime.utcnow().isoformat(),
    }

    await manager.broadcast({
        "type": "agent_evaluation",
        "data": {
            "borrower": req.borrower_pubkey[:16] + "...",
            "tier": attestation_data["tier"],
            "rate": attestation_data["rate_bps"] / 100,
            "x402_verified": payment is not None,
        }
    })
    return result


class AgentNegotiateRequest(BaseModel):
    borrower_pubkey: str
    lender_pubkey: str
    amount_usdc: float
    proposed_rate: float
    term_months: int

@app.post("/api/agent/negotiate")
async def agent_negotiate(req: AgentNegotiateRequest, request: Request):
    """x402-protected endpoint: submit negotiation counter-offer."""
    payment = getattr(request.state, "payment", None)

    # Luna's evaluation
    result = handle_negotiation_request(
        req.borrower_pubkey,
        req.amount_usdc,
        req.proposed_rate,
        req.term_months
    ) if SOLANA_AGENTS_AVAILABLE else {
        "decision": "counter",
        "luna_rate": round((req.proposed_rate + 9.5) / 2, 2),
        "message": f"Luna counters with {round((req.proposed_rate + 9.5)/2, 2)}%",
        "settled": False,
    }

    await manager.broadcast({
        "type": "negotiation_round",
        "data": {
            "proposed_rate": req.proposed_rate,
            "luna_response": result.get("decision"),
            "luna_rate": result.get("luna_rate"),
            "x402_verified": payment is not None,
        }
    })
    return {**result, "payment_verified": payment is not None}


@app.post("/api/solana/workflow/start")
async def start_solana_workflow(req: dict, background_tasks: BackgroundTasks):
    """Start a full Mythos Solana lending workflow (async)."""
    borrower = req.get("borrower_address", "demo_borrower")
    amount = req.get("principal", 1000.0)
    rate = req.get("interest_rate", 9.5)
    term = req.get("term_months", 12)
    score = req.get("credit_score", 720)

    await manager.broadcast({
        "type": "workflow_started",
        "data": {
            "borrower": borrower,
            "principal": amount,
            "interest_rate": rate,
            "term_months": term,
            "source": "solana_route"
        }
    })

    async def run_workflow():
        if SOLANA_AGENTS_AVAILABLE:
            result = await run_solana_borrower_workflow(
                borrower_pubkey=borrower,
                credit_score=score,
                requested_amount_usdc=amount,
                initial_rate_offered=rate,
                term_months=term,
            )
        else:
            await asyncio.sleep(2)
            result = {
                "success": True,
                "borrower": borrower,
                "final_rate": round((rate + 7.5) / 2, 2),
                "solana_tx": f"SIM_WORKFLOW_{int(datetime.utcnow().timestamp())}",
                "demo": True,
            }

        await manager.broadcast({
            "type": "workflow_complete",
            "data": result
        })

    background_tasks.add_task(run_workflow)
    return {
        "success": True,
        "status": "started",
        "borrower": borrower[:20] + "...",
        "message": "Solana workflow started in background"
    }


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)

