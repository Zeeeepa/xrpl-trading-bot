import { Client } from 'xrpl';
import config from '../config';

let persistentClient: Client | null = null;
let connectingPromise: Promise<void> | null = null;

export async function getClient(): Promise<Client> {
    if (persistentClient && persistentClient.isConnected()) {
        return persistentClient;
    }

    if (connectingPromise) {
        await connectingPromise;
        return persistentClient!;
    }

    connectingPromise = (async () => {
        persistentClient = new Client(config.xrpl.server);
        await persistentClient.connect();
        
        persistentClient.on('disconnected', async () => {
            console.log('⚠️ XRPL client disconnected, attempting reconnect...');
            try {
                await persistentClient!.connect();
                console.log('✅ XRPL client reconnected');
            } catch (error) {
                console.error('❌ XRPL client reconnect failed:', error);
            }
        });

        connectingPromise = null;
        console.log('✅ Connected to XRPL');
    })();

    await connectingPromise;
    return persistentClient!;
}

export async function disconnect(): Promise<void> {
    if (persistentClient && persistentClient.isConnected()) {
        await persistentClient.disconnect();
        persistentClient = null;
        console.log('🔌 Disconnected from XRPL');
    }
}

