import { Client } from 'xrpl';
import XRPLAMMChecker from '../../filterAmmCreate';
import { checkLPBurnStatus } from '../xrpl/amm';
import { IUser } from '../database/models';
import { TokenInfo, EvaluationResult } from '../types';
import config from '../config';

export async function isFirstTimeAMMCreator(accountAddress: string): Promise<boolean> {
    try {
        const checker = new XRPLAMMChecker();
        await checker.connect(config.xrpl.server);
        
        const result = await checker.getAccountAMMTransactions(accountAddress);
        const ammCreateCount = result.ammCreateTransactions.length;
        
        checker.close();
        
        return ammCreateCount <= 1;
    } catch (error) {
        console.error('Error checking AMM creator history:', error instanceof Error ? error.message : 'Unknown error');
        return false;
    }
}

/**
 * Evaluate token for sniping based on user criteria
 */
export async function evaluateToken(
    client: Client,
    user: IUser,
    tokenInfo: TokenInfo
): Promise<EvaluationResult> {
    const evaluation: EvaluationResult = {
        shouldSnipe: false,
        reasons: []
    };

    // Check if already owned
    const alreadyOwned = user.sniperPurchases?.some(p =>
        p.tokenAddress === tokenInfo.issuer && 
        p.tokenSymbol === tokenInfo.currency &&
        p.status === 'active'
    );

    if (alreadyOwned) {
        evaluation.reasons.push('Token already in active purchases');
        return evaluation;
    }

    // Whitelist check (if whitelist-only mode)
    if (user.selectedSniperBuyMode === false) {
        const isWhitelisted = user.whiteListedTokens?.some(token =>
            token.currency === tokenInfo.currency && token.issuer === tokenInfo.issuer
        );

        if (!isWhitelisted) {
            evaluation.reasons.push('Token not in whitelist');
            return evaluation;
        }
    }

    // Rugcheck (if auto-buy mode)
    if (user.selectedSniperBuyMode === true) {
        const minLiquidity = user.selectedMinimumPoolLiquidity || 100;
        
        if (tokenInfo.initialLiquidity === null) {
            // Accept tokens with null initial liquidity
            evaluation.reasons.push('Null initial liquidity accepted');
        } else if (tokenInfo.initialLiquidity !== undefined && tokenInfo.initialLiquidity < minLiquidity) {
            evaluation.reasons.push(`Insufficient liquidity: ${tokenInfo.initialLiquidity} XRP < ${minLiquidity} XRP`);
            return evaluation;
        } else {
            evaluation.reasons.push(`Liquidity check passed: ${tokenInfo.initialLiquidity} XRP`);
        }
    }

    // First-time creator check
    if (!tokenInfo.account) {
        evaluation.reasons.push('No account information');
        return evaluation;
    }

    const isFirstTime = await isFirstTimeAMMCreator(tokenInfo.account);
    if (!isFirstTime) {
        evaluation.reasons.push('Not a first-time AMM creator');
        return evaluation;
    }
    evaluation.reasons.push('First-time creator check passed');

    // LP burn check
    const lpBurnCheck = await checkLPBurnStatus(client, tokenInfo);
    if (!lpBurnCheck.lpBurned) {
        evaluation.reasons.push(`LP tokens not burned yet (LP Balance: ${lpBurnCheck.lpBalance})`);
        return evaluation;
    }
    evaluation.reasons.push('LP burn check passed');

    // All checks passed
    evaluation.shouldSnipe = true;
    return evaluation;
}

/**
 * Check if token is blacklisted
 */
export function isTokenBlacklisted(
    blackListedTokens: any[] | undefined,
    currency: string,
    issuer: string
): boolean {
    if (!blackListedTokens || blackListedTokens.length === 0) {
        return false;
    }

    return blackListedTokens.some(token =>
        token.currency === currency && token.issuer === issuer
    );
}

