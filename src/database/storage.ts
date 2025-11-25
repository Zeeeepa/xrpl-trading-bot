import * as fs from 'fs';
import * as path from 'path';
import { IUser } from './models';
import config from '../config';

const DATA_FILE = config.storage.dataFile.startsWith('./') || config.storage.dataFile.startsWith('../')
    ? path.join(process.cwd(), config.storage.dataFile)
    : config.storage.dataFile;

const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let users: Map<string, IUser> = new Map();

export function loadState(): void {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            
            if (Array.isArray(parsed.users)) {
                users = new Map(parsed.users.map((u: any) => [u.userId, {
                    ...u,
                    copyTradingStartTime: u.copyTradingStartTime ? new Date(u.copyTradingStartTime) : new Date(),
                    sniperStartTime: u.sniperStartTime ? new Date(u.sniperStartTime) : undefined,
                    tokens: (u.tokens || []).map((t: any) => ({
                        ...t,
                        lastUpdated: new Date(t.lastUpdated)
                    })),
                    transactions: (u.transactions || []).map((t: any) => ({
                        ...t,
                        timestamp: new Date(t.timestamp)
                    })),
                    sniperPurchases: (u.sniperPurchases || []).map((p: any) => ({
                        ...p,
                        timestamp: new Date(p.timestamp)
                    })),
                    whiteListedTokens: (u.whiteListedTokens || []).map((t: any) => ({
                        ...t,
                        lastUpdated: new Date(t.lastUpdated)
                    })),
                    blackListedTokens: (u.blackListedTokens || []).map((t: any) => ({
                        ...t,
                        lastUpdated: new Date(t.lastUpdated)
                    }))
                }]));
            }
        } else {
            saveState();
        }
    } catch (error) {
        console.error('Error loading state:', error);
        users = new Map();
    }
}

export function saveState(): void {
    try {
        const data = {
            users: Array.from(users.values()),
            lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

export function initialize(): void {
    loadState();
    
    setInterval(() => {
        saveState();
    }, 30000);
    
    process.on('SIGINT', () => {
        saveState();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        saveState();
        process.exit(0);
    });
}

export function getUser(userId: string): IUser | null {
    return users.get(userId) || null;
}

export function saveUser(user: IUser): void {
    users.set(user.userId, user);
    saveState();
}

export function getAllUsers(): IUser[] {
    return Array.from(users.values());
}

export function deleteUser(userId: string): boolean {
    const deleted = users.delete(userId);
    if (deleted) {
        saveState();
    }
    return deleted;
}

export function userExists(userId: string): boolean {
    return users.has(userId);
}
