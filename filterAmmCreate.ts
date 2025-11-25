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
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                this.handleMessage(JSON.parse(data.toString()));
            });

            this.ws.on('error', (error: Error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                // Connection closed
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
            const response = await this.request({
                command: 'account_tx',
                account: accountAddress,
                ledger_index_min: -1,
                ledger_index_max: -1,
                limit: limit,
                forward: true
            });

            // Filter for AMMCreate transactions
            const ammCreateTxs = response.transactions ? response.transactions.filter((tx: any) => 
                tx.tx?.TransactionType === 'AMMCreate'
            ) : [];

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
            console.error('Error fetching account transactions:', error instanceof Error ? error.message : 'Unknown error');
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
                return { isNewCreator: true, ammHistory: [] };
            } else if (ammTransactions.length === 1) {
                return { isNewCreator: true, ammHistory: [ammTransactions[0]] };
            } else {
                return { isNewCreator: false, ammHistory: ammTransactions };
            }
        } catch (error) {
            console.error('Error checking token launch status:', error instanceof Error ? error.message : 'Unknown error');
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

// Test function (only runs when executed directly)
async function testAMMChecker(): Promise<void> {
    const checker = new XRPLAMMChecker();
    
    try {
        await checker.connect();
        await checker.getAccountAMMTransactions(testAccount);
        // Test completed silently
    } catch (error) {
        console.error('Test failed:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
        checker.close();
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testAMMChecker();
}

