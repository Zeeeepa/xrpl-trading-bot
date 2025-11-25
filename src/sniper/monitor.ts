import { Client } from 'xrpl';
import { TokenInfo } from '../types';
import { hexToString } from '../xrpl/utils';

export async function detectNewTokensFromAMM(client: Client): Promise<TokenInfo[]> {
    try {
        const response = await client.request({
            command: 'ledger',
            ledger_index: 'validated',
            transactions: true,
            expand: true
        });

        const newTokens: TokenInfo[] = [];
        const allTransactions: any[] = [];

        for (let i = 0; i <= 3; i++) {
            try {
                const ledgerResponse = i === 0 ? response : await client.request({
                    command: 'ledger',
                    ledger_index: (response.result as any).ledger.ledger_index - i,
                    transactions: true,
                    expand: true
                });
                
                const txWrappers = (ledgerResponse.result as any).ledger.transactions || [];
                const txs = txWrappers
                    .filter((wrapper: any) => wrapper.tx_json && wrapper.meta)
                    .map((wrapper: any) => ({
                        ...wrapper.tx_json,
                        meta: wrapper.meta
                    }));

                allTransactions.push(...txs);
            } catch (error) {
                continue;
            }
        }

        for (const tx of allTransactions) {
            if (tx.TransactionType === 'AMMCreate' && tx.meta?.TransactionResult === 'tesSUCCESS') {
                const tokenInfo = extractTokenFromAMMCreate(tx);
                if (tokenInfo) {
                    newTokens.push(tokenInfo);
                }
            }
        }

        return newTokens;
    } catch (error) {
        console.error('Error detecting AMM tokens:', error);
        return [];
    }
}

export function extractTokenFromAMMCreate(tx: any): TokenInfo | null {
    try {
        const { Amount, Amount2 } = tx;
        let xrpAmount: number;
        let tokenInfo: any;

        if (typeof Amount === 'string') {
            xrpAmount = parseInt(Amount) / 1000000;
            tokenInfo = Amount2;
        } else {
            xrpAmount = parseInt(Amount2) / 1000000;
            tokenInfo = Amount;
        }

        if (!tokenInfo || typeof tokenInfo === 'string') {
            return null;
        }

        return {
            currency: tokenInfo.currency,
            issuer: tokenInfo.issuer,
            readableCurrency: hexToString(tokenInfo.currency),
            initialLiquidity: xrpAmount,
            tokenAmount: tokenInfo.value,
            transactionHash: tx.hash || '',
            account: tx.Account
        };
    } catch (error) {
        return null;
    }
}

