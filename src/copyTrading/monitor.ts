import { Client } from 'xrpl';
import { getTransactionTime, hexToString } from '../xrpl/utils';
import { TradeInfo, CopyTradeData } from '../types';

const processedTransactions = new Set<string>();

export async function checkTraderTransactions(
    client: Client,
    traderAddress: string,
    startTime: Date | null = null
): Promise<CopyTradeData[]> {
    try {
        const response = await client.request({
            command: 'account_tx',
            account: traderAddress,
            limit: 20,
            ledger_index_min: -1,
            ledger_index_max: -1,
            forward: false
        });

        const transactions = (response.result as any)?.transactions || [];
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);

        const newTrades: CopyTradeData[] = [];

        for (const txData of transactions) {
            const tx = txData?.tx || txData?.tx_json || txData;
            const meta = txData?.meta;

            const txHash = tx?.hash || txData?.hash;
            if (!txHash) {
                continue;
            }

            if (processedTransactions.has(txHash)) {
                continue;
            }

            if (meta?.TransactionResult !== 'tesSUCCESS') {
                continue;
            }

            const txTime = getTransactionTime(txData);
            if (txTime && txTime < oneMinuteAgo) {
                continue;
            }

            if (startTime && txTime && txTime < startTime) {
                continue;
            }

            const tradeInfo = detectTradingActivity(tx, meta, traderAddress);
            if (tradeInfo) {
                processedTransactions.add(txHash);
                newTrades.push({
                    txHash,
                    tx,
                    meta,
                    tradeInfo
                });
            }
        }

        if (processedTransactions.size > 1000) {
            const oldEntries = Array.from(processedTransactions).slice(0, 500);
            oldEntries.forEach(entry => processedTransactions.delete(entry));
        }

        return newTrades;
    } catch (error) {
        console.error(`Error checking transactions for ${traderAddress}:`, error instanceof Error ? error.message : 'Unknown error');
        return [];
    }
}

function detectTradingActivity(tx: any, meta: any, traderAddress: string): TradeInfo | null {
    try {
        if (!tx || !meta || tx.Account !== traderAddress) return null;

        if (tx.TransactionType === 'Payment') {
            return parsePaymentTransaction(tx, meta);
        }

        return parseConsumedOffers(tx, meta, traderAddress);
    } catch (error) {
        console.error('Error detecting trading activity:', error);
        return null;
    }
}

function parsePaymentTransaction(_tx: any, meta: any): TradeInfo | null {
    try {
        if (!meta.AffectedNodes) return null;

        let xrpAmount = 0;
        let tokenAmount = 0;
        let currency: string | null = null;
        let issuer: string | null = null;
        let tradeType: 'buy' | 'sell' | null = null;

        for (const node of meta.AffectedNodes) {
            const modifiedNode = node.ModifiedNode;
            if (modifiedNode && modifiedNode.LedgerEntryType === 'AMM') {
                const prevFields = modifiedNode.PreviousFields;
                const finalFields = modifiedNode.FinalFields;

                if (prevFields && finalFields) {
                    if (prevFields.amount && finalFields.amount) {
                        const prevAmount = typeof prevFields.amount === 'string' 
                            ? parseInt(prevFields.amount) / 1000000 
                            : parseFloat(prevFields.amount);
                        const finalAmount = typeof finalFields.amount === 'string'
                            ? parseInt(finalFields.amount) / 1000000
                            : parseFloat(finalFields.amount);
                        
                        const diff = finalAmount - prevAmount;
                        if (Math.abs(diff) > 0.000001) {
                            if (diff > 0) {
                                xrpAmount = Math.abs(diff);
                                tradeType = 'sell';
                            } else {
                                xrpAmount = Math.abs(diff);
                                tradeType = 'buy';
                            }
                        }
                    }

                    if (prevFields.amount2 && finalFields.amount2) {
                        const prevAmount2 = prevFields.amount2.value || prevFields.amount2;
                        const finalAmount2 = finalFields.amount2.value || finalFields.amount2;
                        
                        const prevToken = typeof prevAmount2 === 'string' ? parseFloat(prevAmount2) : prevAmount2;
                        const finalToken = typeof finalAmount2 === 'string' ? parseFloat(finalAmount2) : finalAmount2;
                        
                        const diff = finalToken - prevToken;
                        if (Math.abs(diff) > 0.000001) {
                            tokenAmount = Math.abs(diff);
                            if (finalFields.amount2.currency) {
                                currency = finalFields.amount2.currency;
                                issuer = finalFields.amount2.issuer;
                            }
                        }
                    }
                }
            }
        }

        if (xrpAmount > 0 && tokenAmount > 0 && currency && issuer && tradeType) {
            return {
                type: tradeType,
                currency: currency,
                issuer: issuer,
                readableCurrency: currency.length === 40 ? hexToString(currency) : currency,
                xrpAmount: xrpAmount,
                tokenAmount: tokenAmount,
                method: 'AMM'
            };
        }

        return null;
    } catch (error) {
        console.error('Error parsing payment transaction:', error);
        return null;
    }
}

function parseConsumedOffers(_tx: any, meta: any, _traderAddress: string): TradeInfo | null {
    try {
        if (!meta.AffectedNodes) return null;

        let totalXRP = 0;
        let totalTokens = 0;
        let currency: string | null = null;
        let issuer: string | null = null;
        let tradeType: 'buy' | 'sell' | null = null;

        for (const node of meta.AffectedNodes) {
            const deletedNode = node.DeletedNode;
            const modifiedNode = node.ModifiedNode;

            if (deletedNode && deletedNode.LedgerEntryType === 'Offer') {
                const offer = deletedNode.FinalFields || deletedNode.PreviousFields;
                if (offer) {
                    const analysis = analyzeOffer(offer);
                    if (analysis.xrp && analysis.tokens && analysis.curr) {
                        totalXRP += analysis.xrp;
                        totalTokens += analysis.tokens;
                        currency = analysis.curr;
                        issuer = analysis.iss;
                        tradeType = analysis.type;
                    }
                }
            }

            if (modifiedNode && modifiedNode.LedgerEntryType === 'Offer') {
                const prevFields = modifiedNode.PreviousFields;
                const finalFields = modifiedNode.FinalFields;
                if (prevFields && finalFields) {
                    const consumedXRP = calculateConsumedXRP(prevFields, finalFields);
                    const consumedTokens = calculateConsumedTokens(prevFields, finalFields);
                    if (consumedXRP && consumedTokens) {
                        totalXRP += consumedXRP.amount;
                        totalTokens += consumedTokens.amount;
                        currency = consumedTokens.currency;
                        issuer = consumedTokens.issuer;
                        tradeType = consumedXRP.type;
                    }
                }
            }
        }

        if (totalXRP > 0 && totalTokens > 0 && currency && issuer && tradeType) {
            return {
                type: tradeType,
                currency: currency,
                issuer: issuer,
                readableCurrency: currency.length === 40 ? hexToString(currency) : currency,
                xrpAmount: totalXRP,
                tokenAmount: totalTokens,
                method: 'DEX'
            };
        }

        return null;
    } catch (error) {
        console.error('Error parsing consumed offers:', error);
        return null;
    }
}

function analyzeOffer(offer: any): { xrp: number; tokens: number; curr: string | null; iss: string | null; type: 'buy' | 'sell' | null } {
    try {
        const takerGets = offer.TakerGets;
        const takerPays = offer.TakerPays;

        let xrp = 0;
        let tokens = 0;
        let curr: string | null = null;
        let iss: string | null = null;
        let type: 'buy' | 'sell' | null = null;

        if (typeof takerGets === 'string') {
            xrp = parseInt(takerGets) / 1000000;
            if (takerPays && typeof takerPays === 'object') {
                tokens = parseFloat(takerPays.value || takerPays);
                curr = takerPays.currency;
                iss = takerPays.issuer;
                type = 'sell';
            }
        }
        else if (typeof takerPays === 'string') {
            xrp = parseInt(takerPays) / 1000000;
            if (takerGets && typeof takerGets === 'object') {
                tokens = parseFloat(takerGets.value || takerGets);
                curr = takerGets.currency;
                iss = takerGets.issuer;
                type = 'buy';
            }
        }

        return { xrp, tokens, curr, iss, type };
    } catch (error) {
        return { xrp: 0, tokens: 0, curr: null, iss: null, type: null };
    }
}

function calculateConsumedXRP(prevFields: any, finalFields: any): { amount: number; type: 'buy' | 'sell' } | null {
    try {
        const prevTakerGets = prevFields.TakerGets;
        const finalTakerGets = finalFields.TakerGets;
        const prevTakerPays = prevFields.TakerPays;
        const finalTakerPays = finalFields.TakerPays;

        let consumed = 0;
        let type: 'buy' | 'sell' | null = null;

        if (typeof prevTakerGets === 'string' && typeof finalTakerGets === 'string') {
            const prev = parseInt(prevTakerGets) / 1000000;
            const final = parseInt(finalTakerGets) / 1000000;
            consumed = prev - final;
            type = 'sell';
        }
        else if (typeof prevTakerPays === 'string' && typeof finalTakerPays === 'string') {
            const prev = parseInt(prevTakerPays) / 1000000;
            const final = parseInt(finalTakerPays) / 1000000;
            consumed = prev - final;
            type = 'buy';
        }

        return consumed > 0 && type ? { amount: consumed, type } : null;
    } catch (error) {
        return null;
    }
}

function calculateConsumedTokens(prevFields: any, finalFields: any): { amount: number; currency: string; issuer: string } | null {
    try {
        const prevTakerGets = prevFields.TakerGets;
        const finalTakerGets = finalFields.TakerGets;
        const prevTakerPays = prevFields.TakerPays;
        const finalTakerPays = finalFields.TakerPays;

        let consumed = 0;
        let currency: string | null = null;
        let issuer: string | null = null;

        if (prevTakerGets && typeof prevTakerGets === 'object' && 
            finalTakerGets && typeof finalTakerGets === 'object') {
            const prev = parseFloat(prevTakerGets.value || prevTakerGets);
            const final = parseFloat(finalTakerGets.value || finalTakerGets);
            consumed = prev - final;
            currency = finalTakerGets.currency || prevTakerGets.currency;
            issuer = finalTakerGets.issuer || prevTakerGets.issuer;
        }
        else if (prevTakerPays && typeof prevTakerPays === 'object' && 
                 finalTakerPays && typeof finalTakerPays === 'object') {
            const prev = parseFloat(prevTakerPays.value || prevTakerPays);
            const final = parseFloat(finalTakerPays.value || finalTakerPays);
            consumed = prev - final;
            currency = finalTakerPays.currency || prevTakerPays.currency;
            issuer = finalTakerPays.issuer || prevTakerPays.issuer;
        }

        return consumed > 0 && currency && issuer ? { amount: consumed, currency, issuer } : null;
    } catch (error) {
        return null;
    }
}

