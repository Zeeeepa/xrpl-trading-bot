# XRPL Trading Bot v2.0

A modular, high-performance XRPL trading bot with sniper and copy trading capabilities. This version has been completely refactored from the original Telegram bot into a standalone, modular architecture.

## 🚀 Features

- **Token Sniping**: Automatically detect and snipe new tokens from AMM pools
- **Copy Trading**: Mirror trades from successful wallets in real-time
- **Modular Architecture**: Clean, maintainable codebase split into logical modules
- **High Performance**: Optimized for speed and efficiency
- **Configurable**: Easy-to-use configuration system

## 📁 Project Structure

```
xrpl-trading-bot/
├── src/
│   ├── config/          # Configuration management
│   ├── database/         # Database models and connection
│   ├── xrpl/             # XRPL client, wallet, and AMM utilities
│   ├── sniper/           # Token sniping module
│   ├── copyTrading/      # Copy trading module
│   ├── types/            # TypeScript type definitions
│   └── bot.ts            # Main bot orchestrator
├── dist/                 # Compiled JavaScript (after build)
├── index.ts              # Entry point (TypeScript)
├── filterAmmCreate.js    # AMM transaction checker utility
├── tsconfig.json          # TypeScript configuration
├── package.json
└── .env                  # Environment configuration
```

**Note**: This project is written in TypeScript and compiles to JavaScript in the `dist/` folder.

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd xrpl-trading-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build TypeScript** (required before running)
   ```bash
   npm run build
   ```

4. **Configure environment variables**
   Create a `.env` file:
   ```env
   # XRPL Configuration
   XRPL_SERVER=wss://xrplcluster.com
   XRPL_NETWORK=mainnet

   # Wallet Configuration (REQUIRED)
   WALLET_SEED=your_wallet_seed_here
   WALLET_ADDRESS=your_wallet_address_here

   # Storage Configuration (Optional)
   DATA_FILE=./data/state.json

   # Trading Configuration (Optional)
   MIN_LIQUIDITY=100
   MAX_SNIPE_AMOUNT=5000
   DEFAULT_SLIPPAGE=4.0
   SNIPER_CHECK_INTERVAL=8000
   COPY_TRADING_CHECK_INTERVAL=3000
   ```

## 🎯 Usage

### Development (with TypeScript)
```bash
npm run dev
# or with auto-reload
npm run dev:watch
```

### Production (compiled JavaScript)
```bash
# Build first
npm run build

# Then start
npm start
# or
node dist/index.js
```

### Start Only Sniper
```bash
npm run start:sniper
# or
node dist/index.js --sniper
```

### Start Only Copy Trading
```bash
npm run start:copy
# or
node dist/index.js --copy
```

### Start with Custom User ID
```bash
node dist/index.js --user=my-user-id
```

## 📋 Prerequisites

Before running the bot, you need to:

1. **Configure Wallet**: Set `WALLET_SEED` and `WALLET_ADDRESS` in `.env`
2. **Fund Wallet**: Ensure your wallet has sufficient XRP for trading and fees
3. **Create User**: The bot uses in-memory state with JSON file persistence. 
   - User data is automatically stored in `data/state.json`
   - The file is created automatically on first run
   - You can manually edit `data/state.json` to configure user settings

## ⚙️ Configuration

### User Setup

The bot uses JSON file storage (`data/state.json`) instead of MongoDB. You'll need to create a user record manually or use a helper script.

**User Configuration Structure:**
```json
{
  "userId": "your-user-id",
  "walletAddress": "rYourWalletAddress...",
  "seed": "sYourSecretSeed...",
  "publicKey": "...",
  "privateKey": "...",
  "selectedSlippage": 4.0,
  "sniperActive": false,
  "copyTraderActive": false,
  "copyTradersAddresses": [
    "rTrader1WalletAddressHere",
    "rTrader2WalletAddressHere"
  ],
  "selectedTradingAmountMode": "percentage",
  "selectedMatchTraderPercentage": 50,
  "selectedMaxSpendPerTrade": 100,
  "selectedFixedAmountForCopyTrading": 10,
  "sniperPurchases": [],
  "transactions": [],
  "whiteListedTokens": [],
  "blackListedTokens": []
}
```

### Sniper Configuration

Configure sniper settings in your user record:

- `selectedSniperBuyMode`: `true` for auto-buy with rugcheck, `false` for whitelist-only
- `selectedSnipeAmount`: Amount in XRP (or 'custom')
- `selectedCustomSnipeAmount`: Custom amount if using 'custom' mode
- `selectedMinimumPoolLiquidity`: Minimum liquidity required (rugcheck)
- `whiteListedTokens`: Array of whitelisted tokens (for whitelist mode)
- `blackListedTokens`: Array of blacklisted tokens

### Copy Trading Configuration

Configure copy trading settings in your user record in `data/state.json`:

**Required Settings:**
- `copyTradersAddresses`: Array of trader wallet addresses to copy (XRPL addresses starting with 'r')
  ```json
  "copyTradersAddresses": [
    "rTrader1WalletAddressHere",
    "rTrader2WalletAddressHere"
  ]
  ```

**Optional Settings:**
- `selectedTradingAmountMode`: Trading amount calculation mode (`"percentage"`, `"fixed"`, or `"match"`)
- `selectedMatchTraderPercentage`: Percentage of trader's amount to match (0-100)
- `selectedMaxSpendPerTrade`: Maximum XRP to spend per copy trade
- `selectedFixedAmountForCopyTrading`: Fixed XRP amount for each copy trade
- `selectedTradingAmountMode`: `'fixed'` or `'percentage'`
- `selectedFixedAmountForCopyTrading`: Fixed XRP amount (if using fixed mode)
- `selectedMatchTraderPercentage`: Percentage to match (if using percentage mode)
- `selectedMaxSpendPerTrade`: Maximum XRP per trade
- `selectedSlippage`: Slippage tolerance percentage

## 🔧 Module Overview

### Sniper Module (`src/sniper/`)
- **monitor.js**: Detects new tokens from AMM create transactions
- **evaluator.js**: Evaluates tokens based on user criteria (rugcheck, whitelist, etc.)
- **index.js**: Main sniper logic and orchestration

### Copy Trading Module (`src/copyTrading/`)
- **monitor.js**: Monitors trader wallets for new transactions
- **executor.js**: Executes copy trades based on detected transactions
- **index.js**: Main copy trading logic and orchestration

### XRPL Module (`src/xrpl/`)
- **client.js**: XRPL WebSocket client management
- **wallet.js**: Wallet operations and utilities
- **amm.js**: AMM trading functions (buy/sell)
- **utils.js**: XRPL utility functions

## 🛡️ Safety Features

- Maximum snipe amount limits
- Minimum liquidity requirements (rugcheck)
- Blacklist/whitelist filtering
- Slippage protection
- Transaction deduplication
- Balance validation before trades

## 📊 Monitoring

The bot logs all activities to the console:
- ✅ Successful operations
- ⚠️ Warnings
- ❌ Errors
- 🎯 Sniper activities
- 📊 Copy trading activities

## ⚠️ Important Notes

- **Mainnet Only**: This bot operates on XRPL mainnet with real funds
- **Risk Warning**: Trading cryptocurrencies involves substantial risk
- **No Guarantees**: Past performance doesn't guarantee future results
- **Test First**: Always test with small amounts first

## 🔄 Migration from v1.0

If you're migrating from the Telegram bot version:

Key changes:
- Removed all Telegram dependencies
- Removed MongoDB dependency (now uses JSON file storage)
- Modular architecture (was 9900+ lines in one file)
- Runs as standalone process instead of Telegram bot
- State is stored in `data/state.json` instead of MongoDB

**Note**: If you have existing MongoDB data, you'll need to export it and convert to the JSON format. See `data/state.json.example` for the structure.

## 📝 License

MIT License - Use at your own risk.

## 🤝 Contributing

Contributions are welcome! Please ensure your code follows the existing modular structure.

---

**⚠️ Disclaimer**: This bot is for educational purposes. Use at your own risk. The developers are not responsible for any financial losses.

## 📞 Contact

For support or questions, reach out on Telegram: [@trum3it](https://t.me/trum3it)

**⭐ Star**: this repository if you find it useful!
