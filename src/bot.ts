import * as db from './database/db';
import { getClient, disconnect as disconnectXRPL } from './xrpl/client';
import * as sniper from './sniper';
import * as copyTrading from './copyTrading';
import { BotOptions, BotStatus } from './types';

class XRPLTradingBot {
    private userId: string;
    private mode: 'sniper' | 'copyTrading' | 'both';
    private isRunning: boolean = false;

    constructor(options: BotOptions = {}) {
        this.userId = options.userId || 'default';
        this.mode = options.mode || 'both';
    }

    /**
     * Start the bot
     */
    async start(): Promise<void> {
        try {
            console.log('🚀 Starting XRPL Trading Bot...');
            
            // Initialize storage
            await db.connect();
            console.log('✅ Storage initialized');

            // Connect to XRPL
            await getClient();
            console.log('✅ XRPL client connected');

            // Start services based on mode
            if (this.mode === 'sniper' || this.mode === 'both') {
                const sniperResult = await sniper.startSniper(this.userId);
                if (sniperResult.success) {
                    console.log('✅ Sniper started');
                } else {
                    console.error('❌ Failed to start sniper:', sniperResult.error);
                }
            }

            if (this.mode === 'copyTrading' || this.mode === 'both') {
                const copyResult = await copyTrading.startCopyTrading(this.userId);
                if (copyResult.success) {
                    console.log('✅ Copy trading started');
                } else {
                    console.error('❌ Failed to start copy trading:', copyResult.error);
                }
            }

            this.isRunning = true;
            console.log('✅ Bot is running!');
            console.log(`   Mode: ${this.mode}`);
            console.log(`   User ID: ${this.userId}`);

            // Handle graceful shutdown
            process.on('SIGINT', () => this.stop());
            process.on('SIGTERM', () => this.stop());

        } catch (error) {
            console.error('❌ Error starting bot:', error);
            throw error;
        }
    }

    /**
     * Stop the bot
     */
    async stop(): Promise<void> {
        try {
            console.log('⏹️ Stopping bot...');

            // Stop sniper
            if (this.mode === 'sniper' || this.mode === 'both') {
                await sniper.stopSniper(this.userId);
            }

            // Stop copy trading
            if (this.mode === 'copyTrading' || this.mode === 'both') {
                await copyTrading.stopCopyTrading(this.userId);
            }

            // Disconnect from XRPL
            await disconnectXRPL();

            // Save state and disconnect
            await db.disconnect();

            this.isRunning = false;
            console.log('✅ Bot stopped');
        } catch (error) {
            console.error('❌ Error stopping bot:', error);
            throw error;
        }
    }

    /**
     * Get bot status
     */
    getStatus(): BotStatus {
        return {
            isRunning: this.isRunning,
            mode: this.mode,
            userId: this.userId,
            sniper: sniper.isRunningSniper(),
            copyTrading: copyTrading.isRunningCopyTrading()
        };
    }
}

export default XRPLTradingBot;

