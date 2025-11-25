// XRPL AMM Transaction Checker
// This script connects to XRPL mainnet and checks for AMMCreate transactions

import WebSocket from 'ws';

const testAccount = 'rwpNZgUHJfXP8pjoCps53YM8fW3X1JFU1c';
const DEFAULT_XRPL_SERVER = 'wss://xrplcluster.com';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
}

interface AMMTransactionResult {
    totalTransactions: number;
    ammCreateTransactions: any[];
    allTransactions: any[];
    accountSequence?: number;
    ledgerRange: {
        min: number;
        max: number;
    };
}

interface AMMAnalysis {
    hash: string;
    creator: string;
    ammAccount: string;
    asset1: string;
    asset2: string;
    asset2Issuer: string;
    tradingFee: number;
    amount1: any;
    amount2: any;
    date: string;
    ledgerIndex: number;
    pairKey: string;
}

export default class XRPLAMMChecker {
    private ws: WebSocket | null = null;
    private requestId: number = 1;
    private pendingRequests: Map<number, PendingRequest> = new Map();

    // Connect to XRPL mainnet WebSocket
    connect(serverUrl: string = DEFAULT_XRPL_SERVER): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(serverUrl);
            
            this.ws.on('open', () => {
                console.log('✅ Connected to XRPL mainnet');
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                this.handleMessage(JSON.parse(data.toString()));
            });

            this.ws.on('error', (error: Error) => {
                console.error('❌ WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
            });
        });
    }

    // Handle incoming WebSocket messages
    private handleMessage(message: any): void {
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id)!;
            this.pendingRequests.delete(message.id);

            if (message.status === 'success') {
                resolve(message.result);
            } else {
                reject(new Error(message.error_message || 'Request failed'));
            }
        }
    }

    // Send request to XRPL
    request(command: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const id = this.requestId++;
            const request = { id, ...command };
            
            this.pendingRequests.set(id, { resolve, reject });
            this.ws.send(JSON.stringify(request));
            
            // Set timeout for requests
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000); // 30 second timeout
        });
    }

    // Get account transactions and filter for AMMCreate
    async getAccountAMMTransactions(accountAddress: string, limit: number = 1000): Promise<AMMTransactionResult> {
        try {
            console.log(`🔍 Searching transactions for account: ${accountAddress}`);
            
            const response = await this.request({
                command: 'account_tx',
                account: accountAddress,
                ledger_index_min: -1,
                ledger_index_max: -1,
                limit: limit,
                forward: true
            });

            console.log(`📊 Total transactions found: ${response.transactions ? response.transactions.length : 0}`);

            // Show all transaction types found
            if (response.transactions && response.transactions.length > 0) {
                const transactionTypes = new Set<string>();
                response.transactions.forEach((tx: any) => {
                    const txType = tx.tx?.TransactionType || 'Unknown';
                    transactionTypes.add(txType);
                });
                
                console.log(`📋 Transaction types found:`);
                Array.from(transactionTypes).sort().forEach(type => {
                    const count = response.transactions.filter((tx: any) => tx.tx?.TransactionType === type).length;
                    console.log(`   - ${type}: ${count} transactions`);
                });
            } else {
                console.log(`📋 No transactions found for this account`);
            }

            // Filter for AMMCreate transactions
            const ammCreateTxs = response.transactions ? response.transactions.filter((tx: any) => 
                tx.tx?.TransactionType === 'AMMCreate'
            ) : [];

            console.log(`🏊 AMMCreate transactions found: ${ammCreateTxs.length}`);

            return {
                totalTransactions: response.transactions ? response.transactions.length : 0,
                ammCreateTransactions: ammCreateTxs,
                allTransactions: response.transactions || [],
                accountSequence: response.account_sequence_available,
                ledgerRange: {
                    min: response.ledger_index_min,
                    max: response.ledger_index_max
                }
            };

        } catch (error) {
            console.error('❌ Error fetching account transactions:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    // Analyze AMMCreate transaction details
    analyzeAMMCreate(tx: any): AMMAnalysis {
        const txData = tx.tx;
        const meta = tx.meta;
        
        // Extract token information
        const asset1 = txData.Asset?.currency || 'XRP';
        const asset2 = txData.Asset2?.currency || 'Unknown';
        const asset2Issuer = txData.Asset2?.issuer || 'N/A';
        
        // Find AMM account from metadata
        let ammAccount = 'Unknown';
        if (meta?.CreatedNode?.NewFields?.AMMAccount) {
            ammAccount = meta.CreatedNode.NewFields.AMMAccount;
        }

        return {
            hash: txData.hash,
            creator: txData.Account,
            ammAccount: ammAccount,
            asset1: asset1,
            asset2: asset2,
            asset2Issuer: asset2Issuer,
            tradingFee: txData.TradingFee || 0,
            amount1: txData.Amount,
            amount2: txData.Amount2,
            date: new Date((txData.date + 946684800) * 1000).toISOString(), // Convert XRPL timestamp
            ledgerIndex: txData.ledger_index,
            pairKey: `${asset1}:${asset2}:${asset2Issuer}`
        };
    }

    // Check if this token pair is new (first AMM creation)
    async checkIfNewTokenLaunch(accountAddress: string): Promise<{ isNewCreator: boolean; ammHistory: any[] }> {
        try {
            const result = await this.getAccountAMMTransactions(accountAddress);
            const ammTransactions = result.ammCreateTransactions;

            if (ammTransactions.length === 0) {
                console.log('✨ This account has never created any AMM pools');
                return { isNewCreator: true, ammHistory: [] };
            } else if (ammTransactions.length === 1) {
                return { isNewCreator: true, ammHistory: [ammTransactions[0]] };
            } else {
                return { isNewCreator: false, ammHistory: ammTransactions };
            }
        } catch (error) {
            console.error('❌ Error checking token launch status:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    // Close WebSocket connection
    close(): void {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Test function
async function testAMMChecker(): Promise<void> {
    const checker = new XRPLAMMChecker();
    
    try {
        await checker.connect();
        
        console.log('\n🚀 Starting AMM transaction analysis...\n');
        
        const result = await checker.getAccountAMMTransactions(testAccount);
        
        console.log('\n📊 Summary:');
        console.log(`Account: ${testAccount}`);
        console.log(`Total transactions: ${result.totalTransactions}`);
        console.log(`AMMCreate transactions: ${result.ammCreateTransactions.length}`);
        
        if (result.totalTransactions === 0) {
            console.log('✨ This account has no transaction history');
        } else if (result.ammCreateTransactions.length === 0) {
            console.log('✨ This account has never created any AMM pools');
        } else {
            console.log('\n🔍 AMM pools created:');
            result.ammCreateTransactions.forEach((amm, index) => {
                const analysis = checker.analyzeAMMCreate(amm);
                console.log(`   ${index + 1}. ${analysis.pairKey}`);
                console.log(`      AMM Account: ${analysis.ammAccount}`);
                console.log(`      Date: ${analysis.date}`);
                console.log(`      Hash: ${analysis.hash}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
        // Close connection
        checker.close();
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    console.log('🔥 XRPL AMM Transaction Checker Started\n');
    testAMMChecker();
}

