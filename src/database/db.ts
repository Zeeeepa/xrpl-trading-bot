import { initialize } from './storage';

let isInitialized: boolean = false;

export async function connect(): Promise<void> {
    if (isInitialized) {
        return;
    }

    try {
        initialize();
        isInitialized = true;
    } catch (error) {
        console.error('Storage initialization error:', error);
        throw error;
    }
}

export async function disconnect(): Promise<void> {
    if (isInitialized) {
        const { saveState } = require('./storage');
        saveState();
        isInitialized = false;
    }
}

export function isConnectedToDB(): boolean {
    return isInitialized;
}
