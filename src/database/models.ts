// User interfaces and types (no mongoose)

export interface IToken {
    currency: string;
    issuer: string;
    balance: string;
    lastUpdated: Date;
}

export interface ITransaction {
    type?: string;
    originalTxHash?: string;
    ourTxHash?: string;
    amount?: number;
    tokenSymbol?: string;
    tokenAddress?: string;
    timestamp: Date;
    status?: string;
    traderAddress?: string;
    tokensReceived?: number;
    actualRate?: string;
    xrpSpent?: number;
    originalMethod?: string;
    originalXrpAmount?: number;
}

export interface ISniperPurchase {
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

export interface IBlackListedToken {
    currency: string;
    issuer: string;
    readableCurrency?: string;
    lastUpdated: Date;
}

export interface IWhiteListedToken {
    currency: string;
    issuer: string;
    balance?: string;
    lastUpdated: Date;
}

export interface IUser {
    userId: string;
    walletAddress: string;
    seed: string;
    publicKey: string;
    privateKey: string;
    
    balance: {
        XRP: number;
        USD: number;
    };
    
    tokens: IToken[];
    transactions: ITransaction[];

    selectedSlippage: number;

    // Copy Trading Settings
    copyTradersAddresses: string[];
    copyTraderActive: boolean;
    copyTradingStartTime: Date;
    selectedTradingAmountMode?: string;
    selectedMatchTraderPercentage?: number;
    selectedMaxSpendPerTrade?: number;
    selectedFixedAmountForCopyTrading?: number;

    // Sniper Settings
    sniperActive: boolean;
    sniperStartTime?: Date;
    selectedSniperBuyMode: boolean;
    selectedSnipeAmount?: string;
    selectedCustomSnipeAmount?: string;
    selectedMinimumPoolLiquidity?: number;
    selectedRiskScore?: string;
    selectedSniperTransactionDevides?: number;
    sniperPurchases: ISniperPurchase[];

    // Token Lists
    whiteListedTokens: IWhiteListedToken[];
    blackListedTokens: IBlackListedToken[];
}

/**
 * Create default user
 */
export function createDefaultUser(userId: string, walletAddress: string, seed: string, publicKey: string, privateKey: string): IUser {
    return {
        userId,
        walletAddress,
        seed,
        publicKey,
        privateKey,
        balance: {
            XRP: 0,
            USD: 0
        },
        tokens: [],
        transactions: [],
        selectedSlippage: 4.0,
        copyTradersAddresses: [],
        copyTraderActive: false,
        copyTradingStartTime: new Date(),
        sniperActive: false,
        selectedSniperBuyMode: false,
        sniperPurchases: [],
        whiteListedTokens: [],
        blackListedTokens: []
    };
}
