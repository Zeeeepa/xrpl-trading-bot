import { initialize } from './storage';

let isInitialized: boolean = false;

/**
 * Initialize storage system (load from JSON file)
 */
export async function connect(): Promise<void> {
    if (isInitialized) {
        return;
    }

    try {
        initialize();
        isInitialized = true;
        console.log('✅ Storage initialized');
    } catch (error) {
        console.error('❌ Storage initialization error:', error);
        throw error;
    }
}

/**
 * Disconnect (save state)
 */
export async function disconnect(): Promise<void> {
    if (isInitialized) {
        const { saveState } = require('./storage');
        saveState();
        isInitialized = false;
        console.log('🔌 Storage disconnected (state saved)');
    }
}

export function isConnectedToDB(): boolean {
    return isInitialized;
}
