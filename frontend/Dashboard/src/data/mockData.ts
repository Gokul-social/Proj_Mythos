/**
 * Lendora AI - Mock Data
 * MVP mock data for Dashboard, Markets, Transactions, and Notifications
 */

export interface DashboardData {
    userBalance: number;
    totalSupplied: number;
    totalBorrowed: number;
    netAPY: number;
    walletAddress: string;
}

export interface MarketAsset {
    symbol: string;
    name: string;
    supplyRate: number;
    borrowRate: number;
    totalLiquidity: number;
    totalBorrowed: number;
    utilizationRate: number;
    logo?: string;
}

export interface Transaction {
    id: string;
    type: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'liquidation';
    amount: number;
    asset: string;
    status: 'completed' | 'pending' | 'failed';
    timestamp: string;
    txHash?: string;
    description: string;
}

export interface Notification {
    id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
}

// Mock Dashboard Data
export const mockDashboardData: DashboardData = {
    userBalance: 12.5432,
    totalSupplied: 45000,
    totalBorrowed: 15000,
    netAPY: 3.25,
    walletAddress: '0x1a29...3b7e',
};

// Mock Markets Data
export const mockMarkets: MarketAsset[] = [
    {
        symbol: 'SOL',
        name: 'Solana',
        supplyRate: 2.5,
        borrowRate: 4.2,
        totalLiquidity: 1250000,
        totalBorrowed: 450000,
        utilizationRate: 36.0,
    },
    {
        symbol: 'USDC',
        name: 'USD Coin',
        supplyRate: 3.8,
        borrowRate: 5.5,
        totalLiquidity: 2500000,
        totalBorrowed: 1200000,
        utilizationRate: 48.0,
    },
    {
        symbol: 'PYUSD',
        name: 'PayPal USD',
        supplyRate: 3.2,
        borrowRate: 5.0,
        totalLiquidity: 1800000,
        totalBorrowed: 750000,
        utilizationRate: 41.7,
    },
];

// Mock Transactions Data
export const mockTransactions: Transaction[] = [
    {
        id: 'tx-001',
        type: 'supply',
        amount: 10000,
        asset: 'USDC',
        status: 'completed',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        description: 'Supplied 10,000 USDC to the lending pool',
    },
    {
        id: 'tx-002',
        type: 'borrow',
        amount: 5000,
        asset: 'PYUSD',
        status: 'completed',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        description: 'Borrowed 5,000 PYUSD from the lending pool',
    },
    {
        id: 'tx-003',
        type: 'withdraw',
        amount: 2000,
        asset: 'USDC',
        status: 'completed',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        txHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        description: 'Withdrew 2,000 USDC from the lending pool',
    },
    {
        id: 'tx-004',
        type: 'repay',
        amount: 1500,
        asset: 'PYUSD',
        status: 'completed',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        description: 'Repaid 1,500 PYUSD to the lending pool',
    },
    {
        id: 'tx-005',
        type: 'supply',
        amount: 5000,
        asset: 'SOL',
        status: 'pending',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        description: 'Supplying 5,000 ETH to the lending pool',
    },
    {
        id: 'tx-006',
        type: 'liquidation',
        amount: 3000,
        asset: 'USDC',
        status: 'completed',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        description: 'Liquidation warning: Position at risk',
    },
];

// Mock Notifications Data
export const mockNotifications: Notification[] = [
    {
        id: 'notif-001',
        type: 'warning',
        title: 'Liquidation Warning',
        message: 'Your borrowed position is approaching the liquidation threshold. Consider adding collateral or repaying part of your loan.',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        read: false,
    },
    {
        id: 'notif-002',
        type: 'success',
        title: 'Supply Successful',
        message: 'Your supply of 10,000 USDC has been successfully processed and is now earning interest.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        read: false,
    },
    {
        id: 'notif-003',
        type: 'info',
        title: 'Interest Payment Received',
        message: 'You have received 45.23 USDC in interest payments from your supplied assets.',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        read: false,
    },
    {
        id: 'notif-004',
        type: 'success',
        title: 'Borrow Successful',
        message: 'Your borrow of 5,000 PYUSD has been successfully processed.',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        read: true,
    },
    {
        id: 'notif-005',
        type: 'info',
        title: 'Market Update',
        message: 'New lending rates are now available. Check the Markets page for updated APY rates.',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        read: true,
    },
    {
        id: 'notif-006',
        type: 'error',
        title: 'Transaction Failed',
        message: 'Your withdrawal transaction failed due to insufficient liquidity. Please try again later.',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        read: true,
    },
];



