"""
Mythos Solana Client — On-Chain Loan Lifecycle Manager
=====================================================
Production-ready client for interacting with the Mythos Anchor program
on Solana Devnet. Uses solana-py and anchorpy for transaction building.

Usage:
    from solana_client import MythosClient
    client = MythosClient.from_env()
    result = await client.initialize_loan(...)
"""

import os
import json
import struct
import asyncio
from pathlib import Path
from typing import Optional, Tuple

from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solders.sysvar import RENT as RENT_SYSVAR_ID
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
from solana.rpc.types import TxOpts
from solana.transaction import Transaction
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import (
    get_associated_token_address,
    create_associated_token_account,
)

# Anchor discriminator helper: sha256("global:<instruction_name>")[:8]
import hashlib


def _anchor_discriminator(instruction_name: str) -> bytes:
    """Compute the 8-byte Anchor instruction discriminator."""
    hash_bytes = hashlib.sha256(f"global:{instruction_name}".encode()).digest()
    return hash_bytes[:8]


# Pre-computed discriminators
DISC_INITIALIZE_PROTOCOL = _anchor_discriminator("initialize_protocol")
DISC_INITIALIZE_LOAN = _anchor_discriminator("initialize_loan")
DISC_DEPOSIT_COLLATERAL = _anchor_discriminator("deposit_collateral")
DISC_FUND_LOAN = _anchor_discriminator("fund_loan")
DISC_REPAY_LOAN = _anchor_discriminator("repay_loan")
DISC_LIQUIDATE_LOAN = _anchor_discriminator("liquidate_loan")


class MythosClient:
    """Client for Mythos Anchor program on Solana."""

    def __init__(
        self,
        rpc_url: str,
        program_id: str,
        payer_keypair: Keypair,
    ):
        self.rpc_url = rpc_url
        self.program_id = Pubkey.from_string(program_id)
        self.payer = payer_keypair
        self.client = AsyncClient(rpc_url, commitment=Confirmed)

    @classmethod
    def from_env(cls) -> "MythosClient":
        """Create client from environment variables."""
        rpc_url = os.getenv(
            "HELIUS_RPC_URL",
            "https://api.devnet.solana.com",
        )
        program_id = os.getenv(
            "MYTHOS_PROGRAM_ID",
            "9Mo1trt6n5dvx1fE92hBsqiberkdtuVcsajS6iVyS8Mr",
        )

        # Load keypair from file or env
        keypair_path = os.getenv(
            "SOLANA_KEYPAIR_PATH",
            os.path.expanduser("~/.config/solana/id.json"),
        )
        if os.path.exists(keypair_path):
            with open(keypair_path, "r") as f:
                secret_key = json.load(f)
            payer = Keypair.from_bytes(bytes(secret_key))
        else:
            # Fallback: generate ephemeral keypair (for testing only)
            payer = Keypair()
            print(f"[MythosClient] WARNING: Using ephemeral keypair {payer.pubkey()}")

        return cls(rpc_url, program_id, payer)

    # ========================================================================
    # PDA Derivation
    # ========================================================================

    def derive_protocol_pda(self) -> Tuple[Pubkey, int]:
        """Derive the protocol state PDA."""
        return Pubkey.find_program_address(
            [b"protocol"],
            self.program_id,
        )

    def derive_loan_pda(self, borrower: Pubkey, loan_id: int) -> Tuple[Pubkey, int]:
        """Derive loan account PDA.

        Seeds: ["loan", borrower_pubkey, loan_id_le_bytes]
        """
        return Pubkey.find_program_address(
            [b"loan", bytes(borrower), struct.pack("<Q", loan_id)],
            self.program_id,
        )

    def derive_vault_pda(self, loan_pda: Pubkey) -> Tuple[Pubkey, int]:
        """Derive collateral vault PDA.

        Seeds: ["vault", loan_pda]
        """
        return Pubkey.find_program_address(
            [b"vault", bytes(loan_pda)],
            self.program_id,
        )

    # ========================================================================
    # Transaction Helpers
    # ========================================================================

    async def _send_tx(self, tx: Transaction) -> str:
        """Sign and send a transaction, returning the signature string."""
        recent_blockhash = (
            await self.client.get_latest_blockhash()
        ).value.blockhash
        tx.recent_blockhash = recent_blockhash
        tx.sign(self.payer)

        opts = TxOpts(skip_confirmation=False, preflight_commitment=Confirmed)
        result = await self.client.send_transaction(tx, self.payer, opts=opts)
        return str(result.value)

    async def get_balance(self, pubkey: Optional[Pubkey] = None) -> float:
        """Get SOL balance in SOL (not lamports)."""
        pk = pubkey or self.payer.pubkey()
        resp = await self.client.get_balance(pk)
        return resp.value / 1e9

    # ========================================================================
    # Instructions
    # ========================================================================

    async def initialize_protocol(
        self,
        treasury: Pubkey,
        min_collateral_ratio_bps: int = 15000,
        liquidation_threshold_bps: int = 12000,
    ) -> str:
        """Initialize the protocol state PDA.

        Args:
            treasury: Treasury wallet pubkey
            min_collateral_ratio_bps: Minimum collateral ratio (default 150%)
            liquidation_threshold_bps: Liquidation threshold (default 120%)

        Returns:
            Transaction signature
        """
        protocol_pda, _ = self.derive_protocol_pda()

        # Instruction data: discriminator + u16 + u16
        data = (
            DISC_INITIALIZE_PROTOCOL
            + struct.pack("<H", min_collateral_ratio_bps)
            + struct.pack("<H", liquidation_threshold_bps)
        )

        from solders.instruction import Instruction, AccountMeta

        ix = Instruction(
            self.program_id,
            data,
            [
                AccountMeta(self.payer.pubkey(), is_signer=True, is_writable=True),
                AccountMeta(protocol_pda, is_signer=False, is_writable=True),
                AccountMeta(treasury, is_signer=False, is_writable=False),
                AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
            ],
        )

        tx = Transaction()
        tx.add(ix)
        return await self._send_tx(tx)

    async def initialize_loan(
        self,
        loan_id: int,
        principal: int,
        interest_rate_bps: int,
        term_seconds: int,
        collateral_mint: Pubkey,
        stablecoin_mint: Pubkey,
    ) -> str:
        """Create a new loan request on-chain.

        Args:
            loan_id: Unique loan identifier
            principal: Loan amount in smallest stablecoin units (e.g. USDC 6 decimals)
            interest_rate_bps: Interest rate in basis points (e.g. 750 = 7.5%)
            term_seconds: Loan duration in seconds
            collateral_mint: Collateral token mint pubkey
            stablecoin_mint: Stablecoin mint pubkey (USDC)

        Returns:
            Transaction signature
        """
        borrower = self.payer.pubkey()
        loan_pda, _ = self.derive_loan_pda(borrower, loan_id)
        vault_pda, _ = self.derive_vault_pda(loan_pda)
        protocol_pda, _ = self.derive_protocol_pda()

        # Instruction data: discriminator + u64 + u64 + u16 + u64
        data = (
            DISC_INITIALIZE_LOAN
            + struct.pack("<Q", loan_id)
            + struct.pack("<Q", principal)
            + struct.pack("<H", interest_rate_bps)
            + struct.pack("<Q", term_seconds)
        )

        from solders.instruction import Instruction, AccountMeta

        ix = Instruction(
            self.program_id,
            data,
            [
                AccountMeta(borrower, is_signer=True, is_writable=True),
                AccountMeta(loan_pda, is_signer=False, is_writable=True),
                AccountMeta(vault_pda, is_signer=False, is_writable=True),
                AccountMeta(protocol_pda, is_signer=False, is_writable=True),
                AccountMeta(collateral_mint, is_signer=False, is_writable=False),
                AccountMeta(stablecoin_mint, is_signer=False, is_writable=False),
                AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
                AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
                AccountMeta(RENT_SYSVAR_ID, is_signer=False, is_writable=False),
            ],
        )

        tx = Transaction()
        tx.add(ix)
        return await self._send_tx(tx)

    async def deposit_collateral(
        self,
        loan_id: int,
        amount: int,
        collateral_mint: Pubkey,
    ) -> str:
        """Deposit collateral into the loan's vault.

        Args:
            loan_id: Loan identifier
            amount: Collateral amount in smallest units
            collateral_mint: Collateral token mint

        Returns:
            Transaction signature
        """
        borrower = self.payer.pubkey()
        loan_pda, _ = self.derive_loan_pda(borrower, loan_id)
        vault_pda, _ = self.derive_vault_pda(loan_pda)
        borrower_ata = get_associated_token_address(borrower, collateral_mint)

        data = DISC_DEPOSIT_COLLATERAL + struct.pack("<Q", amount)

        from solders.instruction import Instruction, AccountMeta

        ix = Instruction(
            self.program_id,
            data,
            [
                AccountMeta(borrower, is_signer=True, is_writable=True),
                AccountMeta(loan_pda, is_signer=False, is_writable=True),
                AccountMeta(borrower_ata, is_signer=False, is_writable=True),
                AccountMeta(vault_pda, is_signer=False, is_writable=True),
                AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            ],
        )

        tx = Transaction()
        tx.add(ix)
        return await self._send_tx(tx)

    async def fund_loan(
        self,
        borrower: Pubkey,
        loan_id: int,
        stablecoin_mint: Pubkey,
        lender_keypair: Optional[Keypair] = None,
    ) -> str:
        """Fund a loan (lender sends stablecoin to borrower).

        Args:
            borrower: Borrower's pubkey
            loan_id: Loan identifier
            stablecoin_mint: Stablecoin mint
            lender_keypair: Optional separate lender keypair (defaults to payer)

        Returns:
            Transaction signature
        """
        lender = lender_keypair or self.payer
        lender_pubkey = lender.pubkey()

        loan_pda, _ = self.derive_loan_pda(borrower, loan_id)
        protocol_pda, _ = self.derive_protocol_pda()
        lender_ata = get_associated_token_address(lender_pubkey, stablecoin_mint)
        borrower_ata = get_associated_token_address(borrower, stablecoin_mint)

        data = DISC_FUND_LOAN

        from solders.instruction import Instruction, AccountMeta

        ix = Instruction(
            self.program_id,
            data,
            [
                AccountMeta(lender_pubkey, is_signer=True, is_writable=True),
                AccountMeta(loan_pda, is_signer=False, is_writable=True),
                AccountMeta(protocol_pda, is_signer=False, is_writable=False),
                AccountMeta(lender_ata, is_signer=False, is_writable=True),
                AccountMeta(borrower_ata, is_signer=False, is_writable=True),
                AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            ],
        )

        tx = Transaction()
        tx.add(ix)

        recent_blockhash = (
            await self.client.get_latest_blockhash()
        ).value.blockhash
        tx.recent_blockhash = recent_blockhash
        tx.sign(lender)

        opts = TxOpts(skip_confirmation=False, preflight_commitment=Confirmed)
        result = await self.client.send_transaction(tx, lender, opts=opts)
        return str(result.value)

    async def repay_loan(
        self,
        loan_id: int,
        stablecoin_mint: Pubkey,
        collateral_mint: Pubkey,
        lender: Pubkey,
    ) -> str:
        """Repay a loan (borrower sends stablecoin to lender, collateral returned).

        Args:
            loan_id: Loan identifier
            stablecoin_mint: Stablecoin mint
            collateral_mint: Collateral mint
            lender: Lender's pubkey

        Returns:
            Transaction signature
        """
        borrower = self.payer.pubkey()
        loan_pda, _ = self.derive_loan_pda(borrower, loan_id)
        vault_pda, _ = self.derive_vault_pda(loan_pda)

        borrower_stablecoin_ata = get_associated_token_address(borrower, stablecoin_mint)
        lender_stablecoin_ata = get_associated_token_address(lender, stablecoin_mint)
        borrower_collateral_ata = get_associated_token_address(borrower, collateral_mint)

        data = DISC_REPAY_LOAN

        from solders.instruction import Instruction, AccountMeta

        ix = Instruction(
            self.program_id,
            data,
            [
                AccountMeta(borrower, is_signer=True, is_writable=True),
                AccountMeta(loan_pda, is_signer=False, is_writable=True),
                AccountMeta(borrower_stablecoin_ata, is_signer=False, is_writable=True),
                AccountMeta(lender_stablecoin_ata, is_signer=False, is_writable=True),
                AccountMeta(vault_pda, is_signer=False, is_writable=True),
                AccountMeta(borrower_collateral_ata, is_signer=False, is_writable=True),
                AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            ],
        )

        tx = Transaction()
        tx.add(ix)
        return await self._send_tx(tx)

    async def liquidate_loan(
        self,
        borrower: Pubkey,
        loan_id: int,
        collateral_mint: Pubkey,
        liquidator_keypair: Optional[Keypair] = None,
    ) -> str:
        """Liquidate an undercollateralized loan.

        Args:
            borrower: Borrower's pubkey
            loan_id: Loan identifier
            collateral_mint: Collateral mint
            liquidator_keypair: Optional separate liquidator keypair (defaults to payer)

        Returns:
            Transaction signature
        """
        liquidator = liquidator_keypair or self.payer
        liquidator_pubkey = liquidator.pubkey()

        loan_pda, _ = self.derive_loan_pda(borrower, loan_id)
        vault_pda, _ = self.derive_vault_pda(loan_pda)
        protocol_pda, _ = self.derive_protocol_pda()
        liquidator_ata = get_associated_token_address(liquidator_pubkey, collateral_mint)

        data = DISC_LIQUIDATE_LOAN

        from solders.instruction import Instruction, AccountMeta

        ix = Instruction(
            self.program_id,
            data,
            [
                AccountMeta(liquidator_pubkey, is_signer=True, is_writable=True),
                AccountMeta(loan_pda, is_signer=False, is_writable=True),
                AccountMeta(protocol_pda, is_signer=False, is_writable=False),
                AccountMeta(vault_pda, is_signer=False, is_writable=True),
                AccountMeta(liquidator_ata, is_signer=False, is_writable=True),
                AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            ],
        )

        tx = Transaction()
        tx.add(ix)

        recent_blockhash = (
            await self.client.get_latest_blockhash()
        ).value.blockhash
        tx.recent_blockhash = recent_blockhash
        tx.sign(liquidator)

        opts = TxOpts(skip_confirmation=False, preflight_commitment=Confirmed)
        result = await self.client.send_transaction(tx, liquidator, opts=opts)
        return str(result.value)

    # ========================================================================
    # Account Fetching
    # ========================================================================

    async def fetch_loan(self, borrower: Pubkey, loan_id: int) -> Optional[dict]:
        """Fetch and decode a loan account from on-chain.

        Returns:
            Decoded loan data dict, or None if not found.
        """
        loan_pda, _ = self.derive_loan_pda(borrower, loan_id)
        resp = await self.client.get_account_info(loan_pda)

        if resp.value is None:
            return None

        data = resp.value.data
        if len(data) < 8:
            return None

        # Skip 8-byte Anchor discriminator
        raw = data[8:]

        # Manual decode matching LoanAccount struct layout:
        # Pubkey(32) + Pubkey(32) + u64 + u16 + u64 + u64 + Pubkey(32) + u64 + Pubkey(32) + u64 + u8(enum) + u8(bump) + u64
        offset = 0

        def read_pubkey():
            nonlocal offset
            pk = Pubkey.from_bytes(raw[offset : offset + 32])
            offset += 32
            return pk

        def read_u64():
            nonlocal offset
            val = struct.unpack_from("<Q", raw, offset)[0]
            offset += 8
            return val

        def read_u16():
            nonlocal offset
            val = struct.unpack_from("<H", raw, offset)[0]
            offset += 2
            return val

        def read_u8():
            nonlocal offset
            val = raw[offset]
            offset += 1
            return val

        borrower_pk = read_pubkey()
        lender_pk = read_pubkey()
        principal = read_u64()
        interest_rate_bps = read_u16()
        term_seconds = read_u64()
        start_time = read_u64()
        collateral_mint = read_pubkey()
        collateral_amount = read_u64()
        stablecoin_mint = read_pubkey()
        amount_repaid = read_u64()
        status_byte = read_u8()
        bump = read_u8()
        loan_id_val = read_u64()

        status_map = {0: "Requested", 1: "Active", 2: "Repaid", 3: "Liquidated"}

        return {
            "borrower": str(borrower_pk),
            "lender": str(lender_pk),
            "principal": principal,
            "interest_rate_bps": interest_rate_bps,
            "term_seconds": term_seconds,
            "start_time": start_time,
            "collateral_mint": str(collateral_mint),
            "collateral_amount": collateral_amount,
            "stablecoin_mint": str(stablecoin_mint),
            "amount_repaid": amount_repaid,
            "status": status_map.get(status_byte, "Unknown"),
            "bump": bump,
            "loan_id": loan_id_val,
            "loan_pda": str(loan_pda),
        }

    async def fetch_protocol(self) -> Optional[dict]:
        """Fetch and decode the protocol state account."""
        protocol_pda, _ = self.derive_protocol_pda()
        resp = await self.client.get_account_info(protocol_pda)

        if resp.value is None:
            return None

        data = resp.value.data
        raw = data[8:]  # skip discriminator

        offset = 0
        admin = Pubkey.from_bytes(raw[0:32])
        offset += 32
        treasury = Pubkey.from_bytes(raw[32:64])
        offset += 32
        min_ratio = struct.unpack_from("<H", raw, offset)[0]
        offset += 2
        liq_threshold = struct.unpack_from("<H", raw, offset)[0]
        offset += 2
        loan_count = struct.unpack_from("<Q", raw, offset)[0]
        offset += 8
        bump = raw[offset]

        return {
            "admin": str(admin),
            "treasury": str(treasury),
            "min_collateral_ratio_bps": min_ratio,
            "liquidation_threshold_bps": liq_threshold,
            "loan_count": loan_count,
            "bump": bump,
            "protocol_pda": str(protocol_pda),
        }

    async def close(self):
        """Close the RPC client connection."""
        await self.client.close()
