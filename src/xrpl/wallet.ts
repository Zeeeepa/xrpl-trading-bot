import { Wallet, Client } from 'xrpl';
import config from '../config';
import { WalletInfo, TokenBalance } from '../types';

export function getWallet(): Wallet {
    if (!config.wallet.seed) {
        throw new Error('Wallet seed not configured. Set WALLET_SEED environment variable.');
    }

    try {
        return Wallet.fromSeed(config.wallet.seed);
    } catch (error) {
        throw new Error(`Failed to create wallet from seed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function generateWallet(): WalletInfo {
    try {
        const wallet = Wallet.generate();
        return {
            publicKey: wallet.publicKey,
            privateKey: wallet.privateKey,
            walletAddress: wallet.address,
            seed: wallet.seed
        };
    } catch (error) {
        throw new Error(`Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function getBalance(client: Client, address: string): Promise<number> {
    try {
        const response = await client.request({
            command: 'account_info',
            account: address,
            ledger_index: 'validated'
        });

        const balanceInXrp = parseFloat((response.result as any).account_data.Balance) / 1000000;
        return balanceInXrp;
    } catch (error: any) {
        if (error.data && error.data.error === 'actNotFound') {
            return 0;
        }
        throw error;
    }
}

export async function getTokenBalances(client: Client, address: string): Promise<TokenBalance[]> {
    try {
        const response = await client.request({
            command: 'account_lines',
            account: address,
            ledger_index: 'validated'
        });

        return (response.result as any).lines.map((line: any) => ({
            currency: line.currency,
            issuer: line.account,
            balance: line.balance,
            lastUpdated: new Date()
        }));
    } catch (error: any) {
        if (error.data && error.data.error === 'actNotFound') {
            return [];
        }
        throw error;
    }
}

export function isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    if (!address.startsWith('r') || address.length < 25 || address.length > 34) return false;
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(address);
}

export async function validateAccount(client: Client, address: string): Promise<boolean> {
    try {
        const accountInfo = await client.request({
            command: 'account_info',
            account: address,
            ledger_index: 'validated'
        });
        return !!(accountInfo.result && (accountInfo.result as any).account_data);
    } catch (error) {
        return false;
    }
}

