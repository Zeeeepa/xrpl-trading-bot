import { Client } from 'xrpl';
import { Wallet } from 'xrpl';

export interface Config {
    xrpl: {
        server: string;
        network: string;
    };
    storage: {
        dataFile: string;
    };
    trading: {
        minLiquidity: number;
        minHolders: number;
        minTradingActivity: number;
        maxSnipeAmount: number;
        emergencyStopLoss: number;
        defaultSlippage: number;
    };
    sniper: {
        checkInterval: number;
        maxTokensPerScan: number;
    };
    copyTrading: {
        checkInterval: number;
        maxTransactionsToCheck: number;
    };
    wallet: {
        seed: string;
        address?: string;
    };
}

export interface TokenInfo {
    currency: string;
    issuer: string;
    readableCurrency?: string;
    initialLiquidity?: number | null;
    tokenAmount?: string;
    transactionHash?: string;
    account?: string;
}

export interface TradeResult {
    success: boolean;
    txHash?: string;
    tokensReceived?: number | string;
    xrpSpent?: number;
    actualRate?: string;
    expectedTokens?: string;
    actualSlippage?: string;
    slippageUsed?: number;
    method?: string;
    error?: string;
    tokensSold?: string;
    xrpReceived?: string;
    expectedXrp?: string;
    marketRate?: string;
    newTokenBalance?: string;
}

export interface SniperPurchase {
    tokenSymbol: string;
    tokenAddress: string;
    currency?: string;
    issuer?: string;
    amount: number;
    tokensReceived?: number;
    timestamp: Date;
    txHash: string;
    status?: string;
}

export interface TradeInfo {
    type: 'buy' | 'sell';
    currency: string;
    issuer: string;
    readableCurrency: string;
    xrpAmount: number;
    tokenAmount?: number;
    method: 'AMM' | 'DEX';
}

export interface CopyTradeData {
    txHash: string;
    tx: any;
    meta: any;
    tradeInfo: TradeInfo;
}

export interface EvaluationResult {
    shouldSnipe: boolean;
    reasons: string[];
}

export interface LPBurnStatus {
    lpBurned: boolean;
    lpBalance: string;
    ammAccount?: string;
    lpTokenCurrency?: string;
    error?: string;
}

export interface BotOptions {
    userId?: string;
    mode?: 'sniper' | 'copyTrading' | 'both';
}

export interface BotStatus {
    isRunning: boolean;
    mode: string;
    userId: string;
    sniper: boolean;
    copyTrading: boolean;
}

export interface WalletInfo {
    publicKey: string;
    privateKey: string;
    walletAddress: string;
    seed: string;
}

export interface TokenBalance {
    currency: string;
    issuer: string;
    balance: string;
    lastUpdated: Date;
}

