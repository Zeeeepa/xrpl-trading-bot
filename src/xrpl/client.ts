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
            try {
                await persistentClient!.connect();
            } catch (error) {
                console.error('XRPL client reconnect failed:', error);
            }
        });

        connectingPromise = null;
    })();

    await connectingPromise;
    return persistentClient!;
}

export async function disconnect(): Promise<void> {
    if (persistentClient && persistentClient.isConnected()) {
        await persistentClient.disconnect();
        persistentClient = null;
    }
}

