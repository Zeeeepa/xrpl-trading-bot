import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

const config: Config = {
    // XRPL Network Configuration
    xrpl: {
        server: process.env.XRPL_SERVER || 'wss://xrplcluster.com',
        network: process.env.XRPL_NETWORK || 'mainnet'
    },

    // Storage Configuration
    storage: {
        dataFile: process.env.DATA_FILE || './data/state.json'
    },

    // Trading Configuration
    trading: {
        minLiquidity: parseFloat(process.env.MIN_LIQUIDITY || '100') || 100,
        minHolders: parseInt(process.env.MIN_HOLDERS || '5') || 5,
        minTradingActivity: parseInt(process.env.MIN_TRADING_ACTIVITY || '3') || 3,
        maxSnipeAmount: parseFloat(process.env.MAX_SNIPE_AMOUNT || '5000') || 5000,
        emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS || '0.3') || 0.3,
        defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || '4.0') || 4.0
    },

    // Sniper Configuration
    sniper: {
        checkInterval: parseInt(process.env.SNIPER_CHECK_INTERVAL || '8000') || 8000,
        maxTokensPerScan: parseInt(process.env.MAX_TOKENS_PER_SCAN || '15') || 15
    },

    // Copy Trading Configuration
    copyTrading: {
        checkInterval: parseInt(process.env.COPY_TRADING_CHECK_INTERVAL || '3000') || 3000,
        maxTransactionsToCheck: parseInt(process.env.MAX_TRANSACTIONS_TO_CHECK || '20') || 20
    },

    // Wallet Configuration
    wallet: {
        seed: process.env.WALLET_SEED || '',
        address: process.env.WALLET_ADDRESS
    }
};

// Validate required configuration
if (!config.wallet.seed) {
    throw new Error('WALLET_SEED environment variable is required');
}

// No validation needed for storage - will use default path

export default config;

