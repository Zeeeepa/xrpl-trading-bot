import { getClient } from '../xrpl/client';
import { getWallet } from '../xrpl/wallet';
import { executeAMMBuy } from '../xrpl/amm';
import { IUser } from '../database/models';
import { User, UserModel } from '../database/user';
import { detectNewTokensFromAMM } from './monitor';
import { evaluateToken, isTokenBlacklisted } from './evaluator';
import { TokenInfo } from '../types';
import config from '../config';

let sniperInterval: NodeJS.Timeout | null = null;
let isRunning: boolean = false;

interface Result {
    success: boolean;
    error?: string;
}

export async function startSniper(userId: string): Promise<Result> {
    if (isRunning) {
        return { success: false, error: 'Sniper is already running' };
    }

    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (!config.sniperUser.buyMode && (!user.whiteListedTokens || user.whiteListedTokens.length === 0)) {
            return { success: false, error: 'No whitelisted tokens for whitelist-only mode' };
        }

        const snipeAmount = parseFloat(
            config.sniperUser.snipeAmount === 'custom' 
                ? (config.sniperUser.customSnipeAmount || '1')
                : (config.sniperUser.snipeAmount || '1')
        ) || 1;

        if (snipeAmount > config.trading.maxSnipeAmount) {
            return { 
                success: false, 
                error: `Snipe amount too high. Maximum: ${config.trading.maxSnipeAmount} XRP` 
            };
        }

        if (!user.sniperPurchases) {
            user.sniperPurchases = [];
        }

        user.sniperActive = true;
        user.sniperStartTime = new Date();
        const userModel = new UserModel(user);
        await userModel.save();

        isRunning = true;
        sniperInterval = setInterval(async () => {
            await monitorTokenMarkets(userId);
        }, config.sniper.checkInterval);

        return { success: true };
    } catch (error) {
        console.error('Error starting sniper:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function stopSniper(userId: string): Promise<Result> {
    try {
        if (sniperInterval) {
            clearInterval(sniperInterval);
            sniperInterval = null;
        }

        const user = await User.findOne({ userId });
        if (user) {
            user.sniperActive = false;
            const userModel = new UserModel(user);
            await userModel.save();
        }

        isRunning = false;
        return { success: true };
    } catch (error) {
        console.error('Error stopping sniper:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

async function monitorTokenMarkets(userId: string): Promise<void> {
    try {
        const user = await User.findOne({ userId });
        if (!user || !user.sniperActive) {
            if (sniperInterval) {
                clearInterval(sniperInterval);
                sniperInterval = null;
            }
            isRunning = false;
            return;
        }

        const client = await getClient();
        const newTokens = await detectNewTokensFromAMM(client);

        for (let i = 0; i < Math.min(newTokens.length, config.sniper.maxTokensPerScan); i++) {
            const tokenInfo = newTokens[i];
            await evaluateAndSnipeToken(client, user, tokenInfo);
        }
    } catch (error) {
        console.error('Monitor error:', error instanceof Error ? error.message : 'Unknown error');
    }
}

async function evaluateAndSnipeToken(client: any, user: IUser, tokenInfo: TokenInfo): Promise<void> {
    try {
        const evaluation = await evaluateToken(client, user, tokenInfo);

        if (!evaluation.shouldSnipe) {
            return;
        }

        await executeSnipe(client, user, tokenInfo);
    } catch (error) {
        console.error(`Error evaluating token:`, error instanceof Error ? error.message : 'Unknown error');
    }
}

async function executeSnipe(client: any, user: IUser, tokenInfo: TokenInfo): Promise<void> {
    try {
        const wallet = getWallet();
        let snipeAmount: number;
        if (config.sniperUser.snipeAmount === 'custom') {
            if (!config.sniperUser.customSnipeAmount || isNaN(parseFloat(config.sniperUser.customSnipeAmount))) {
                console.error('Invalid custom snipe amount');
                return;
            }
            snipeAmount = parseFloat(config.sniperUser.customSnipeAmount);
        } else {
            snipeAmount = parseFloat(config.sniperUser.snipeAmount || '1') || 1;
        }

        if (isNaN(snipeAmount) || snipeAmount <= 0) {
            console.error('Invalid snipe amount');
            return;
        }

        if (snipeAmount > config.trading.maxSnipeAmount) {
            console.error(`Snipe amount exceeds maximum: ${snipeAmount} > ${config.trading.maxSnipeAmount}`);
            return;
        }

        const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address
        });

        const xrpBalance = parseFloat((accountInfo.result as any).account_data.Balance) / 1000000;
        const totalRequired = snipeAmount + 0.5;

        if (xrpBalance < totalRequired) {
            console.error(`Insufficient balance: ${xrpBalance} XRP < ${totalRequired} XRP required`);
            return;
        }

        if (isTokenBlacklisted(user.blackListedTokens, tokenInfo.currency, tokenInfo.issuer)) {
            return;
        }

        const buyResult = await executeAMMBuy(
            client,
            wallet,
            tokenInfo,
            snipeAmount,
            config.trading.defaultSlippage
        );

        if (buyResult.success && buyResult.txHash) {
            if (!user.sniperPurchases) {
                user.sniperPurchases = [];
            }

            user.sniperPurchases.push({
                tokenSymbol: tokenInfo.readableCurrency || tokenInfo.currency,
                tokenAddress: tokenInfo.issuer,
                currency: tokenInfo.currency,
                issuer: tokenInfo.issuer,
                amount: snipeAmount,
                tokensReceived: typeof buyResult.tokensReceived === 'number' ? buyResult.tokensReceived : parseFloat(String(buyResult.tokensReceived || 0)),
                timestamp: new Date(),
                txHash: buyResult.txHash,
                status: 'active'
            });

            user.transactions.push({
                type: 'snipe_buy',
                ourTxHash: buyResult.txHash,
                amount: snipeAmount,
                tokenSymbol: tokenInfo.readableCurrency || tokenInfo.currency,
                tokenAddress: tokenInfo.issuer,
                timestamp: new Date(),
                status: 'success',
                tokensReceived: typeof buyResult.tokensReceived === 'number' ? buyResult.tokensReceived : parseFloat(String(buyResult.tokensReceived || 0)),
                xrpSpent: snipeAmount,
                actualRate: buyResult.actualRate || '0'
            });

            const userModel = new UserModel(user);
            await userModel.save();
        } else {
            console.error(`Snipe failed: ${buyResult.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error executing snipe:', error);
    }
}

export function isRunningSniper(): boolean {
    return isRunning;
}

