# Lendora AI - Ethereum Migration Guide

## Executive Summary

This document outlines the migration from Cardano-based architecture to Ethereum-native stack, preserving all core functionality, security guarantees, and AI-agent workflows while leveraging Ethereum's mature ecosystem.

## Architecture Comparison

### Cardano Stack (Current)
- **Smart Contracts**: Aiken / Plutus (eUTxO model)
- **Layer 2**: Hydra Heads
- **Privacy**: Midnight Network (ZK proofs)
- **Identity**: Atala PRISM (DID)
- **Oracles**: Charli3
- **Wallets**: CIP-30 (Nami, Eternl)
- **Assets**: ADA, DJED/USDM

### Ethereum Stack (Target)
- **Smart Contracts**: Solidity (EVM, account-based)
- **Layer 2**: Arbitrum or Optimism
- **Privacy**: Circom + SnarkJS (or Noir)
- **Identity**: SIWE (Sign-In with Ethereum), ENS
- **Oracles**: Chainlink price feeds & automation
- **Wallets**: MetaMask, WalletConnect
- **Assets**: ETH/WETH, USDC/DAI

## Core Migration Changes

### 1. Smart Contract Architecture

#### eUTxO → Account-Based Model

**Cardano (Aiken)**:
- State held in UTxOs at script addresses
- Datum holds loan metadata
- Redeemer contains settlement parameters
- Both parties must sign transaction

**Ethereum (Solidity)**:
- State held in contract storage variables
- Mapping: `loanId => LoanStruct`
- Functions modify state directly
- Access control via `onlyBorrower`/`onlyLender` modifiers

#### Contract Structure

```
contracts/
├── core/
│   ├── LoanManager.sol          # Main loan orchestration
│   ├── CollateralVault.sol      # Collateral management
│   ├── InterestRateModel.sol    # Dynamic interest calculations
│   └── LiquidationEngine.sol    # Automated liquidations
├── zk/
│   ├── CreditScoreVerifier.sol  # ZK proof verifier
│   └── circuits/
│       └── credit_score.circom  # ZK circuit definition
└── interfaces/
    ├── IERC20.sol               # Token standard
    └── IChainlinkOracle.sol     # Oracle interface
```

### 2. Layer 2 Scaling

#### Hydra Heads → Ethereum L2

**Current (Hydra)**:
- Off-chain state channels for negotiation
- Zero gas fees during negotiation
- Final settlement on L1

**Target (Arbitrum/Optimism)**:
- Off-chain AI agent negotiation (state in backend)
- Final settlement on L2 (lower fees than L1)
- Leverages L2's native low-cost transactions

**Implementation**:
- AI agents negotiate off-chain (same as before)
- Final agreed terms sent to L2 contract
- Users sign transactions via MetaMask
- Contract verifies and executes on L2

### 3. Privacy Layer

#### Midnight → Circom/SnarkJS

**Current (Midnight)**:
- Midnight Compact language for ZK circuits
- Network handles proof generation
- On-chain proof verification

**Target (Circom + SnarkJS)**:
- Circom for circuit definition
- SnarkJS for proof generation (client-side or server)
- Solidity verifier contract for on-chain verification

**Circuit Logic**:
```circom
template CreditCheck() {
    signal private input creditScore;
    signal output isEligible;

    component gt = GreaterThan(32);
    gt.in[0] <== creditScore;
    gt.in[1] <== 700; // Minimum threshold
    isEligible <== gt.out;
}

component main = CreditCheck();
```

### 4. Identity & Authentication

#### Atala PRISM → SIWE + ENS

**Current (Atala PRISM)**:
- Decentralized Identifiers (DID)
- Cardano-specific identity system

**Target (SIWE + ENS)**:
- Sign-In with Ethereum (EIP-4361)
- ENS for human-readable addresses
- Ethereum address as identity

**Implementation**:
- User signs message with wallet
- Backend verifies signature
- ENS optional for display names

### 5. Oracle Integration

#### Charli3 → Chainlink

**Current (Charli3)**:
- Cardano-specific oracle
- Manual integration

**Target (Chainlink)**:
- Chainlink Price Feeds for collateral prices
- Chainlink Automation for liquidation triggers
- Standardized oracle interface

**Usage**:
- ETH/USD price feed for collateral valuation
- Automation cron jobs for health check monitoring
- Keepers trigger liquidations when needed

### 6. Wallet Integration

#### CIP-30 → MetaMask/WalletConnect

**Current (CIP-30)**:
- Browser extension wallets (Nami, Eternl)
- `window.cardano` API
- Cardano address format (bech32)

**Target (EIP-1193)**:
- MetaMask (primary)
- WalletConnect (mobile/multi-wallet)
- Ethereum address format (0x...)

## System Architecture

### Workflow Diagram

```
┌─────────────┐
│  Borrower   │
└──────┬──────┘
       │ 1. Submit Credit Score (private)
       ▼
┌─────────────────────────────────┐
│  ZK Proof Generation (Circom)   │
│  - Credit Score → ZK Proof      │
│  - Only is_eligible revealed    │
└──────┬──────────────────────────┘
       │ 2. ZK Proof + Eligibility
       ▼
┌─────────────┐
│   Lender    │
└──────┬──────┘
       │ 3. Loan Offer
       ▼
┌─────────────────────────────────┐
│  AI Agent Negotiation (Off-chain)│
│  - Borrower Agent (Lenny)       │
│  - Lender Agent (Luna)          │
│  - Negotiate terms              │
└──────┬──────────────────────────┘
       │ 4. Final Terms Agreed
       ▼
┌─────────────────────────────────┐
│  Ethereum L2 Settlement         │
│  - User signs transaction       │
│  - LoanManager.executeLoan()    │
│  - CollateralVault.deposit()    │
│  - Loan disbursed               │
└─────────────────────────────────┘
```

### State Management

#### Cardano (eUTxO)
- UTxO contains: Datum (loan data) + Value (locked funds)
- State exists at script address
- Immutable until spent

#### Ethereum (Account-based)
```solidity
struct Loan {
    address borrower;
    address lender;
    uint256 principal;
    uint256 interestRate; // in basis points
    uint256 termMonths;
    uint256 collateralAmount;
    address collateralToken;
    uint256 createdAt;
    uint256 repaidAt;
    LoanStatus status;
    bytes32 zkProofHash;
}

mapping(uint256 => Loan) public loans;
uint256 public nextLoanId;
```

## Security Considerations

### 1. Access Control
- Use OpenZeppelin's `Ownable` and `AccessControl`
- Role-based permissions (BORROWER_ROLE, LENDER_ROLE)
- Function modifiers: `onlyBorrower()`, `onlyLender()`

### 2. Reentrancy Protection
- Use OpenZeppelin's `ReentrancyGuard`
- Checks-Effects-Interactions pattern
- External calls last in function execution

### 3. ZK Proof Verification
- Verify proofs on-chain before loan creation
- Store proof hash in loan struct
- Prevent replay attacks with nonces

### 4. Oracle Security
- Use Chainlink's decentralized oracle network
- Verify price freshness (stale price checks)
- Use multiple price feeds for critical assets

### 5. Gas Optimization
- Pack structs efficiently
- Use events instead of storage for historical data
- Batch operations where possible
- Consider L2-specific optimizations

## Gas Optimization Strategies

### 1. Storage Optimization
```solidity
// Bad: 3 storage slots
uint256 principal;
uint256 interestRate;
uint256 termMonths;

// Good: 2 storage slots (packed)
uint128 principal;      // Slot 1
uint64 interestRate;    // Slot 1 (lower 64 bits)
uint64 termMonths;      // Slot 2
```

### 2. Event-Based Logging
```solidity
// Store minimal data on-chain
// Emit events for off-chain indexing
event LoanCreated(
    uint256 indexed loanId,
    address indexed borrower,
    address indexed lender,
    uint256 principal,
    uint256 interestRate
);
```

### 3. L2-Specific Optimizations
- Use L2's lower gas costs for complex operations
- Leverage L2's faster finality for UI updates
- Batch multiple operations in single transaction

## Migration Assumptions

### Preserved Functionality
- AI agent negotiation workflows
- Non-custodial architecture (users control keys)
- Privacy-preserving credit checks (ZK proofs)
- Automated liquidation system
- Real-time WebSocket updates
- Dashboard UI/UX

### Limitations & Trade-offs
- **Gas Costs**: Ethereum has gas fees (mitigated by L2)
- **Finality**: L2 finality (~1-2 seconds) vs Cardano (~20 seconds)
- **ZK Proof Generation**: Client-side or server-side (was network-handled)
- **Identity**: Ethereum addresses less privacy-preserving than DIDs

### Testing Strategy
1. Unit tests for all Solidity contracts (Hardhat/Foundry)
2. Integration tests for L2 deployment
3. ZK circuit tests (Circom)
4. End-to-end tests for AI agent workflows
5. Gas profiling and optimization

## Deployment Strategy

### L2 Choice: Arbitrum vs Optimism

**Arbitrum** (Recommended):
- Mature ecosystem
- Lower gas costs
- Good developer tooling
- Compatible with existing Ethereum tools

**Optimism** (Alternative):
- EVM-equivalent (slightly higher security)
- OP Stack for custom chains
- Bedrock upgrade improves efficiency

### Deployment Steps
1. Deploy to Arbitrum Testnet
2. Test all contract functions
3. Deploy ZK verifier contract
4. Integrate Chainlink oracles (testnet)
5. Deploy frontend with testnet contracts
6. Test end-to-end workflows
7. Security audit (if production)
8. Deploy to Arbitrum Mainnet

## File Structure (Post-Migration)

```
Lendora-AI/
├── contracts/
│   ├── core/
│   │   ├── LoanManager.sol
│   │   ├── CollateralVault.sol
│   │   ├── InterestRateModel.sol
│   │   └── LiquidationEngine.sol
│   ├── zk/
│   │   ├── CreditScoreVerifier.sol
│   │   └── circuits/
│   │       ├── credit_score.circom
│   │       └── compile.sh
│   ├── interfaces/
│   │   ├── IERC20.sol
│   │   └── IChainlinkOracle.sol
│   ├── scripts/
│   │   └── deploy.js
│   └── test/
│       └── LoanManager.test.js
├── backend/
│   ├── ethereum/
│   │   ├── tx_builder.py      # Replaces cardano/tx_builder.py
│   │   └── contract_client.py # Web3.py client
│   ├── zk/
│   │   └── proof_generator.py # Circom proof generation
│   └── oracles/
│       └── chainlink_client.py # Replaces credit_oracle.py
├── frontend/
│   └── src/
│       ├── lib/
│       │   └── wallet/
│       │       └── ethereum-wallet.ts  # Replaces cardano-wallet.ts
│       └── hooks/
│           └── useEthereumWallet.ts    # Replaces useWallet.ts
└── agents/
    └── [AI agents remain similar, but use Ethereum L2 instead of Hydra]
```

## Next Steps

1. Create migration architecture document (this file)
2. Implement Solidity contracts
3. Set up Circom ZK circuits
4. Create Ethereum transaction builder
5. Update AI agents for Ethereum L2
6. Replace wallet integration
7. Integrate Chainlink oracles
8. Update frontend components
9. Deploy to Arbitrum testnet
10. End-to-end testing

## References

- [Arbitrum Documentation](https://docs.arbitrum.io/)
- [Circom Documentation](https://docs.circom.io/)
- [Chainlink Documentation](https://docs.chain.link/)
- [SIWE Specification](https://eips.ethereum.org/EIPS/eip-4361)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

