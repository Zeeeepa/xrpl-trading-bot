import { IUser, createDefaultUser } from './models';
import { getUser, saveUser, userExists } from './storage';

/**
 * Find user by ID (MongoDB-like interface)
 */
export async function findUser(userId: string): Promise<IUser | null> {
    return getUser(userId);
}

/**
 * Find one user (MongoDB-like interface)
 */
export const User = {
    findOne: async (query: { userId?: string; walletAddress?: string }): Promise<IUser | null> => {
        if (query.userId) {
            return getUser(query.userId);
        }
        if (query.walletAddress) {
            const { getAllUsers } = require('./storage');
            const users = getAllUsers();
            return users.find((u: IUser) => u.walletAddress === query.walletAddress) || null;
        }
        return null;
    },
    
    findById: async (userId: string): Promise<IUser | null> => {
        return getUser(userId);
    },
    
    create: async (userData: Partial<IUser>): Promise<IUser> => {
        if (!userData.userId || !userData.walletAddress || !userData.seed) {
            throw new Error('Missing required user fields');
        }
        
        const user: IUser = {
            ...createDefaultUser(
                userData.userId,
                userData.walletAddress,
                userData.seed,
                userData.publicKey || '',
                userData.privateKey || ''
            ),
            ...userData
        } as IUser;
        
        saveUser(user);
        return user;
    }
};

/**
 * User helper class with save method
 */
export class UserModel {
    private user: IUser;

    constructor(user: IUser) {
        this.user = user;
    }

    async save(): Promise<IUser> {
        saveUser(this.user);
        return this.user;
    }

    toObject(): IUser {
        return this.user;
    }

    get userId(): string { return this.user.userId; }
    get walletAddress(): string { return this.user.walletAddress; }
    get seed(): string { return this.user.seed; }
    get publicKey(): string { return this.user.publicKey; }
    get privateKey(): string { return this.user.privateKey; }
    get balance() { return this.user.balance; }
    get tokens() { return this.user.tokens; }
    get transactions() { return this.user.transactions; }
    get selectedSlippage() { return this.user.selectedSlippage; }
    get copyTradersAddresses() { return this.user.copyTradersAddresses; }
    get copyTraderActive() { return this.user.copyTraderActive; }
    get copyTradingStartTime() { return this.user.copyTradingStartTime; }
    get selectedTradingAmountMode() { return this.user.selectedTradingAmountMode; }
    get selectedMatchTraderPercentage() { return this.user.selectedMatchTraderPercentage; }
    get selectedMaxSpendPerTrade() { return this.user.selectedMaxSpendPerTrade; }
    get selectedFixedAmountForCopyTrading() { return this.user.selectedFixedAmountForCopyTrading; }
    get sniperActive() { return this.user.sniperActive; }
    get sniperStartTime() { return this.user.sniperStartTime; }
    get selectedSniperBuyMode() { return this.user.selectedSniperBuyMode; }
    get selectedSnipeAmount() { return this.user.selectedSnipeAmount; }
    get selectedCustomSnipeAmount() { return this.user.selectedCustomSnipeAmount; }
    get selectedMinimumPoolLiquidity() { return this.user.selectedMinimumPoolLiquidity; }
    get selectedRiskScore() { return this.user.selectedRiskScore; }
    get selectedSniperTransactionDevides() { return this.user.selectedSniperTransactionDevides; }
    get sniperPurchases() { return this.user.sniperPurchases; }
    get whiteListedTokens() { return this.user.whiteListedTokens; }
    get blackListedTokens() { return this.user.blackListedTokens; }

    // Setters
    set selectedSlippage(value: number) { this.user.selectedSlippage = value; }
    set copyTraderActive(value: boolean) { this.user.copyTraderActive = value; }
    set copyTradingStartTime(value: Date) { this.user.copyTradingStartTime = value; }
    set sniperActive(value: boolean) { this.user.sniperActive = value; }
    set sniperStartTime(value: Date | undefined) { this.user.sniperStartTime = value; }
    set selectedSniperBuyMode(value: boolean) { this.user.selectedSniperBuyMode = value; }
    set selectedSnipeAmount(value: string | undefined) { this.user.selectedSnipeAmount = value; }
    set selectedCustomSnipeAmount(value: string | undefined) { this.user.selectedCustomSnipeAmount = value; }
    set selectedMinimumPoolLiquidity(value: number | undefined) { this.user.selectedMinimumPoolLiquidity = value; }
    set selectedTradingAmountMode(value: string | undefined) { this.user.selectedTradingAmountMode = value; }
    set selectedMatchTraderPercentage(value: number | undefined) { this.user.selectedMatchTraderPercentage = value; }
    set selectedMaxSpendPerTrade(value: number | undefined) { this.user.selectedMaxSpendPerTrade = value; }
    set selectedFixedAmountForCopyTrading(value: number | undefined) { this.user.selectedFixedAmountForCopyTrading = value; }
}

