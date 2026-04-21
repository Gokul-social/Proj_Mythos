from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import asyncio

from .config import PROJECT_NAME, VERSION, PORT, HOST
from .ws_manager import manager
from .routers import stats, agents, solana
from .x402_middleware import x402_middleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {PROJECT_NAME} API v{VERSION}")
    yield
    # Shutdown
    print(f"Shutting down {PROJECT_NAME} API")

app = FastAPI(
    title=f"{PROJECT_NAME} API",
    version=VERSION,
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-PAYMENT", "X-PAYMENT-REQUIRED"],
    expose_headers=["X-PAYMENT-REQUIRED"],
)

app.middleware("http")(x402_middleware)

# Routers
app.include_router(stats.router)
app.include_router(agents.router)
app.include_router(solana.router)

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {PROJECT_NAME}",
        "version": VERSION,
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "ok", "project": PROJECT_NAME}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
