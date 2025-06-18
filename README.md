# SDK Comparison Demo: Sponsored Transactions

A Next.js benchmarking application that compares the performance and features of four major SDKs for sponsored transactions in Web3:

- **Gelato SmartWallet SDK** - Purpose-built for EIP-7702
- **Alchemy** - Gas Manager powered
- **ZeroDev UltraRelay** - UltraRelay bundler
- **Pimlico** - Pimlico paymaster service

## 🚀 Features

### Real-time Benchmarking
- **Latency Measurement**: Tracks transaction execution time in seconds
- **Gas Usage**: Monitors L1 and L2 gas consumption
- **Live Updates**: Table updates in real-time as transactions complete
- **Parallel Execution**: All four SDKs run simultaneously for fair comparison

### SDK Comparison Metrics
| Metric | Description |
|--------|-------------|
| **Latency (s)** | Transaction execution time from submission to confirmation |
| **L1 Gas** | Gas used on Layer 1 (Base Sepolia) |
| **L2 Gas** | Gas used on Layer 2 |
| **Paymaster** | Paymaster service used for transaction sponsoring |
| **EIP-7702 Support** | Whether the SDK is purpose-built for EIP-7702 |

### UI Features
- **Responsive Grid Layout**: 4 cards displaying each SDK
- **Real-time Metrics**: Live updates during transaction execution
- **Toast Notifications**: Success/error feedback for each transaction
- **Loading States**: Visual feedback during transaction processing

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with shadcn/ui components
- **Blockchain**: Base Sepolia testnet
- **SDKs**:
  - `@gelatonetwork/smartwallet` - Gelato SmartWallet SDK
  - `@alchemy/aa-alchemy` - Alchemy Account Abstraction
  - `@zerodev/sdk` - ZeroDev UltraRelay
  - `permissionless` - Pimlico integration

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Base Sepolia testnet access
- API keys for each service

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gelato-comparison-demo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory with the following variables:

## 🔑 Environment Variables

### Required Variables

```env
# Gelato SmartWallet SDK
NEXT_PUBLIC_SPONSOR_API_KEY=your_gelato_sponsor_api_key

# Alchemy
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_PAYMASTER_POLICY_ID=your_alchemy_paymaster_policy_id

# ZeroDev UltraRelay
NEXT_PUBLIC_ULTRA_RELAY_URL=your_zerodev_ultra_relay_url

# Pimlico
NEXT_PUBLIC_PIMLICO_URL=your_pimlico_api_url
```

### How to Get API Keys

#### Gelato SmartWallet SDK
1. Visit [Gelato Console](https://console.gelato.network/)
2. Create an account and get your Sponsor API key
3. Add it to `NEXT_PUBLIC_SPONSOR_API_KEY`

#### Alchemy
1. Go to [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Create a new app for Base Sepolia
3. Get your API key and add to `NEXT_PUBLIC_ALCHEMY_API_KEY`
4. Create a Gas Manager policy and add the policy ID to `NEXT_PUBLIC_PAYMASTER_POLICY_ID`

#### ZeroDev UltraRelay
1. Visit [ZeroDev Console](https://console.zerodev.app/)
2. Get your UltraRelay URL
3. Add it to `NEXT_PUBLIC_ULTRA_RELAY_URL`

#### Pimlico
1. Go to [Pimlico Dashboard](https://dashboard.pimlico.io/)
2. Get your API URL
3. Add it to `NEXT_PUBLIC_PIMLICO_URL`

## 🚀 Running the Application

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   Navigate to `http://localhost:3000`

3. **Run the benchmark**
   Click the "Run Sponsored Transaction" button to execute all four SDKs in parallel

## 📊 Understanding the Results

### Performance Metrics
- **Latency**: Lower is better - measures transaction speed
- **L1 Gas**: Gas used on Ethereum mainnet (Base Sepolia)
- **L2 Gas**: Gas used on the L2 network
- **Paymaster**: Shows which service is sponsoring the transaction

### Key Differences
- **Gelato**: Purpose-built for EIP-7702, optimized performance
- **Alchemy**: Gas Manager integration, reliable infrastructure
- **ZeroDev**: UltraRelay bundler, fast user operations
- **Pimlico**: Pimlico paymaster, competitive pricing

## 🔍 Code Structure

```
├── app/
│   └── page.tsx              # Main page component
├── components/
│   └── ui/                   # shadcn/ui components
├── sdk-comparison.tsx        # Main benchmarking component
├── README.md                 # This file
└── package.json
```

### Key Functions
- `runGelatoSponsoredTransaction()` - Gelato SmartWallet implementation
- `runAlchemySponsoredTransaction()` - Alchemy Gas Manager implementation
- `runUltraRelaySponsoredTransaction()` - ZeroDev UltraRelay implementation
- `runPimlicoSponsoredTransaction()` - Pimlico paymaster implementation
- `runAllSponsoredTransactions()` - Parallel execution of all SDKs

## 🐛 Troubleshooting

### Common Issues

1. **Missing API Keys**
   - Ensure all environment variables are set
   - Check that API keys are valid and have proper permissions

2. **Network Issues**
   - Verify you're connected to Base Sepolia testnet
   - Check RPC endpoint availability

3. **Transaction Failures**
   - Ensure sufficient testnet ETH for gas fees
   - Check paymaster policy configurations

4. **Build Errors**
   - Clear Next.js cache: `rm -rf .next`
   - Reinstall dependencies: `npm install`

### Debug Mode
Enable console logging by checking the browser's developer tools for detailed error messages and transaction hashes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Resources

- [Gelato Documentation](https://docs.gelato.network/)
- [Alchemy Documentation](https://docs.alchemy.com/)
- [ZeroDev Documentation](https://docs.zerodev.app/)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

---

**Note**: This is a demonstration project for comparing SDK performance. Results may vary based on network conditions, API rate limits, and other factors. Always test thoroughly in your own environment before production use. 