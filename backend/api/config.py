import os
from dotenv import load_dotenv

load_dotenv()

PROJECT_NAME = "Mythos"
VERSION = "3.0.0"

# Solana
SOLANA_NETWORK = os.getenv("SOLANA_NETWORK", "devnet")
MYTHOS_PROGRAM_ID = os.getenv("MYTHOS_PROGRAM_ID", "FGG8363rUtdVernzHtXr4AD9PS9m4BezgAN8MJKcybpM")
HELIUS_API_KEY = os.getenv("HELIUS_API_KEY", "demo")
SOLANA_DEMO_MODE = os.getenv("SOLANA_DEMO_MODE", "true").lower() == "true"
X402_DEMO_MODE = os.getenv("X402_DEMO_MODE", "true").lower() == "true"

# Program IDs
SPL_TOKEN_PROGRAM_ID = os.getenv("SPL_TOKEN_PROGRAM_ID", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
SPL_RENT_SYSVAR_ID = os.getenv("SPL_RENT_SYSVAR_ID", "SysvarRent111111111111111111111111111111111")
USDC_MINT_DEVNET = os.getenv("USDC_MINT", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")

# RPC URL
HELIUS_RPC_URL = (
    f"https://{SOLANA_NETWORK}.helius-rpc.com/?api-key={HELIUS_API_KEY}"
    if HELIUS_API_KEY != "demo"
    else f"https://api.{SOLANA_NETWORK}.solana.com"
)

# AI / LLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "dummy-key-for-development")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "dummy-key-for-development")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Server
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")

# Agent Wallets
LENNY_WALLET_ADDRESS = os.getenv(
    "LENNY_WALLET_ADDRESS",
    "LennyBorrowerAgentXXXXXXXXXXXXXXXXXXXXXXXX"
)
LUNA_WALLET_ADDRESS = os.getenv(
    "LUNA_WALLET_ADDRESS",
    "LunaLenderAgentXXXXXXXXXXXXXXXXXXXXXXXXX"
)
TREASURY_WALLET = os.getenv(
    "TREASURY_WALLET",
    "61m3ESHMhzDygAUWkSyXTCBr6Jy9gSnSF3Dqm6fxhg6s"
)
