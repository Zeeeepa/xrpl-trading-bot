import { Client } from 'xrpl';
import { getClient } from '../xrpl/client';
import { getWallet } from '../xrpl/wallet';
import { IUser } from '../database/models';
import { User, UserModel } from '../database/user';
import { checkTraderTransactions } from './monitor';
import { 
    calculateCopyTradeAmount, 
    executeCopyBuyTrade, 
    executeCopySellTrade,
    isTokenBlacklisted,
    wasTransactionCopied
} from './executor';
import { TradeInfo } from '../types';
import config from '../config';

let copyTradingIntervals = new Map<string, NodeJS.Timeout>();
let isRunning: boolean = false;

interface Result {
    success: boolean;
    error?: string;
}

export async function startCopyTrading(userId: string): Promise<Result> {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (user.copyTraderActive) {
            return { success: false, error: 'Copy trading is already active' };
        }

        if (!config.copyTrading.traderAddresses || config.copyTrading.traderAddresses.length === 0) {
            return { success: false, error: 'No traders added. Please set COPY_TRADER_ADDRESSES in .env' };
        }

        user.copyTraderActive = true;
        user.copyTradingStartTime = new Date();
        const userModel = new UserModel(user);
        await userModel.save();

        const interval = setInterval(async () => {
            await monitorTraders(userId);
        }, config.copyTrading.checkInterval);

        copyTradingIntervals.set(userId, interval);
        isRunning = true;

        return { success: true };
    } catch (error) {
        console.error('Error starting copy trading:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function stopCopyTrading(userId: string): Promise<Result> {
    try {
        const interval = copyTradingIntervals.get(userId);
        if (interval) {
            clearInterval(interval);
            copyTradingIntervals.delete(userId);
        }

        const user = await User.findOne({ userId });
        if (user) {
            user.copyTraderActive = false;
            const userModel = new UserModel(user);
            await userModel.save();
        }

        if (copyTradingIntervals.size === 0) {
            isRunning = false;
        }

        return { success: true };
    } catch (error) {
        console.error('Error stopping copy trading:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

async function monitorTraders(userId: string): Promise<void> {
    try {
        const user = await User.findOne({ userId });
        if (!user || !user.copyTraderActive) {
            const interval = copyTradingIntervals.get(userId);
            if (interval) {
                clearInterval(interval);
                copyTradingIntervals.delete(userId);
            }
            return;
        }

        if (!config.copyTrading.traderAddresses || config.copyTrading.traderAddresses.length === 0) {
            return;
        }

        const client = await getClient();

        for (const traderAddress of config.copyTrading.traderAddresses) {
            await checkAndCopyTrades(client, user, traderAddress);
        }
    } catch (error) {
        console.error('Error monitoring traders:', error instanceof Error ? error.message : 'Unknown error');
    }
}

async function checkAndCopyTrades(client: Client, user: IUser, traderAddress: string): Promise<void> {
    try {
        const newTrades = await checkTraderTransactions(
            client,
            traderAddress,
            user.copyTradingStartTime
        );

        for (const tradeData of newTrades) {
            const { txHash, tradeInfo } = tradeData;

            if (wasTransactionCopied(user.transactions, txHash)) {
                continue;
            }

            if (isTokenBlacklisted(
                user.blackListedTokens,
                tradeInfo.currency,
                tradeInfo.issuer
            )) {
                continue;
            }

            const tradeAmount = calculateCopyTradeAmount(user, tradeInfo);
            if (!tradeAmount || tradeAmount <= 0) {
                continue;
            }

            await executeCopyTrade(client, user, traderAddress, tradeInfo, tradeAmount, txHash);
        }
    } catch (error) {
        console.error(`Error checking trades for ${traderAddress}:`, error instanceof Error ? error.message : 'Unknown error');
    }
}

async function executeCopyTrade(
    client: Client,
    user: IUser,
    traderAddress: string,
    tradeInfo: TradeInfo,
    tradeAmount: number,
    originalTxHash: string
): Promise<void> {
    try {
        const wallet = getWallet();
        let copyResult;

        if (tradeInfo.type === 'buy') {
            copyResult = await executeCopyBuyTrade(client, wallet, user, tradeInfo, tradeAmount);
        } else if (tradeInfo.type === 'sell') {
            const tokenAmount = tradeAmount;
            copyResult = await executeCopySellTrade(client, wallet, user, tradeInfo, tokenAmount);
        } else {
            return;
        }

        if (copyResult && copyResult.success && copyResult.txHash) {
            user.transactions.push({
                type: `copy_${tradeInfo.type}`,
                originalTxHash: originalTxHash,
                ourTxHash: copyResult.txHash,
                amount: tradeAmount,
                tokenSymbol: tradeInfo.readableCurrency,
                tokenAddress: tradeInfo.issuer,
                timestamp: new Date(),
                status: 'success',
                traderAddress: traderAddress,
                tokensReceived: typeof copyResult.tokensReceived === 'number' 
                    ? copyResult.tokensReceived 
                    : parseFloat(String(copyResult.tokensReceived || 0)),
                xrpSpent: copyResult.xrpSpent || tradeAmount,
                actualRate: copyResult.actualRate || '0'
            });

            const userModel = new UserModel(user);
            await userModel.save();
        } else {
            console.error(`Copy trade failed: ${copyResult?.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error executing copy trade:', error);
    }
}

export function isRunningCopyTrading(): boolean {
    return isRunning;
}

