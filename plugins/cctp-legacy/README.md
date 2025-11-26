# CCTP (Cross-Chain Transfer Protocol) Data Provider Plugin

## Provider Information

**Protocol:** Circle Cross-Chain Transfer Protocol (CCTP)
**Type:** Native burn-and-mint bridge for USDC
**Website:** https://www.circle.com/en/cross-chain-transfer-protocol
**Documentation:** https://developers.circle.com/stablecoins/docs/cctp-getting-started

## Overview

CCTP is Circle's native cross-chain transfer protocol that enables USDC to move securely between blockchains via native burning and minting. This is **not a wrapped asset bridge** - USDC is burned on the source chain and native USDC is minted on the destination chain, maintaining 1:1 backing.

### Key Features
- **USDC-only**: Protocol exclusively supports USDC transfers
- **1:1 transfers**: Burn-and-mint mechanism ensures no slippage
- **No wrapped assets**: Transfers result in native USDC on destination chain
- **Fast transfers**: ~8-20 seconds with Fast Transfer option
- **Standard transfers**: ~15 minutes waiting for finality (unlimited)

## Implementation Details

### Data Sources

| Metric | Source | Endpoint/API |
|--------|--------|--------------|
| **Volumes** | DefiLlama Bridge API | `https://bridges.llama.fi/bridge/cctp` |
| **Rates** | Circle CCTP Iris API | `GET /v2/burn/USDC/fees/{sourceDomain}/{destDomain}` |
| **Liquidity** | Circle CCTP Iris API | `GET /v2/fastBurn/USDC/allowance` |
| **Assets** | Circle Documentation | Official USDC contract addresses |

### API Endpoints Used

**Circle Iris API (https://iris-api.circle.com)**

```
GET /v2/burn/USDC/fees/{sourceDomain}/{destDomain}
  - Returns fee structure for transfers between domains
  - Response includes Fast Transfer (1000) and Standard (2000) fees
  - Fees typically 1 basis point (0.01%)

GET /v2/fastBurn/USDC/allowance
  - Returns current Fast Transfer allowance (liquidity pool)
  - Updates dynamically based on available collateral
  - Represents maximum amount for instant transfers
```

**DefiLlama Bridge API**

```
GET https://bridges.llama.fi/bridge/cctp
  - Aggregated volume statistics from on-chain data
  - Provides 24h, 7d, 30d volumes
  - Data source: On-chain TokenMessenger burn events
```

### Supported Chains

CCTP supports USDC transfers on the following chains:

| Chain | Chain ID | Domain ID | USDC Address |
|-------|----------|-----------|--------------|
| Ethereum | 1 | 0 | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
| Avalanche | 43114 | 1 | 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E |
| Optimism | 10 | 2 | 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 |
| Arbitrum | 42161 | 3 | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 |
| Base | 8453 | 6 | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| Polygon | 137 | 7 | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 |
| Solana | solana | 5 | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v |

*Source: [Circle CCTP Documentation](https://developers.circle.com/stablecoins/docs/cctp-technical-reference)*

### Rate Calculation

CCTP uses a simple fee-based rate calculation since transfers are 1:1 burn-and-mint:

```typescript
// Fetch fee from Circle API
const fees = await fetch(`${baseUrl}/v2/burn/USDC/fees/${sourceDomain}/${destDomain}`);
const standardFee = fees.find(f => f.finalityThreshold === 2000);

// Calculate output (typically 1 bps = 0.01% fee)
const feeBps = standardFee.minimumFee; // Usually 1 bps
const feeUsd = (amountIn * feeBps) / 10000;
const amountOut = amountIn - feeUsd;

// Effective rate (very close to 1.0 due to minimal fees)
const effectiveRate = amountOut / amountIn; // e.g., 0.9999 (99.99%)
```

### Liquidity Depth Strategy

CCTP liquidity is represented by the **Fast Transfer Allowance**:

```typescript
// Fast Transfer Allowance = real-time collateral pool for instant transfers
const allowance = await fetch(`${baseUrl}/v2/fastBurn/USDC/allowance`);

// 50bps threshold: Fast Transfer limit (8-20 seconds)
maxAmountIn = allowance.allowance; // Real limit from API

// 100bps threshold: Standard Transfer (15 min, effectively unlimited)
maxAmountIn = allowance.allowance * 100; // Large multiplier to indicate no practical limit
```

**Note:** CCTP has no actual slippage (1:1 transfers). The "slippage thresholds" represent transfer speed/finality trade-offs:
- **50bps**: Fast Transfer (limited by allowance, ~8-20 seconds)
- **100bps**: Standard Transfer (unlimited, waits for finality, ~15 minutes)

### Volume Data

Volumes are sourced from **DefiLlama**, which aggregates on-chain burn events across all supported chains:

- **24h volume**: `lastDailyVolume` - Last complete 24-hour period
- **7d volume**: `lastWeeklyVolume` - Last complete 7-day period
- **30d volume**: `lastMonthlyVolume` - Last complete 30-day period

Data is cached for 10 minutes to reduce API calls.

## Configuration

### Environment Variables

```env
# Circle CCTP Iris API Base URL
BASE_URL=https://iris-api.circle.com

# Request timeout in milliseconds
TIMEOUT=15000

# Max requests per second for rate limiting
# CCTP API limit: 35 requests/second
MAX_REQUESTS_PER_SECOND=35

# API Key (not required - CCTP is a public API)
API_KEY=not-required
```

### Example .env

```env
BASE_URL=https://iris-api.circle.com
TIMEOUT=15000
MAX_REQUESTS_PER_SECOND=35
API_KEY=not-required
```

## Running Locally

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Run tests
bun test

# Run development server
bun dev
```

## Testing

The plugin includes comprehensive integration tests:

```bash
# Run all tests
bun run vitest run

# Run with coverage
bun run vitest run --coverage

# Run integration tests specifically
bun run vitest run --config vitest.integration.config.ts
```

### Example Test Usage

```typescript
const result = await client.getSnapshot({
  routes: [{
    source: {
      chainId: "1",      // Ethereum
      assetId: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
    },
    destination: {
      chainId: "137",    // Polygon
      assetId: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      symbol: "USDC",
      decimals: 6,
    }
  }],
  notionals: ["1000000"], // 1 USDC in smallest units (6 decimals)
  includeWindows: ["24h", "7d", "30d"]
});
```

## API Rate Limits

- **Circle CCTP Iris API**: 35 requests/second
- **DefiLlama API**: No strict limit, but we cache for 10 minutes

Rate limiting is handled automatically via token bucket algorithm.

## Known Limitations

1. **USDC Only**: CCTP exclusively supports USDC. Other assets will be skipped with a warning.

2. **No Wrapped Assets**: CCTP burns and mints native USDC - it does not create wrapped tokens.

3. **Domain Restrictions**: Only chains with CCTP domain IDs are supported. New chains require waiting for Circle to add support.

4. **Fast Transfer Limits**: Fast transfers are limited by the allowance pool. Large transfers may need to use Standard Transfer (15 min).

5. **Volume Data Dependency**: Volume metrics depend on DefiLlama's data availability. If DefiLlama is down, volumes will return empty.

## Error Handling

The plugin implements robust error handling:

- **Exponential backoff**: 1s, 2s, 4s retry delays
- **Rate limiting**: Token bucket algorithm respects 35 req/sec limit
- **Timeout handling**: AbortController for clean request cancellation
- **Graceful degradation**: If volumes fail, rates/liquidity still work
- **Detailed logging**: All API calls logged with attempt numbers

## Architecture

```
DataProviderService
├── getSnapshot()           # Main entry point
│   ├── getVolumes()        # DefiLlama Bridge API
│   ├── getRates()          # Circle fees API
│   ├── getLiquidityDepth() # Circle allowance API
│   └── getListedAssets()   # Static USDC addresses
├── fetchDefiLlamaVolumeWithRetry()  # With caching
├── fetchFeesWithRetry()
└── fetchAllowanceWithRetry()
```

## Contract Compliance

This plugin fully implements the NEAR Intents data provider contract:

- ✅ `getSnapshot` endpoint with routes, notionals, includeWindows
- ✅ `ping` health check endpoint
- ✅ Volumes for 24h, 7d, 30d windows
- ✅ Rates with effectiveRate normalized for decimals
- ✅ Liquidity depth with 50bps and 100bps thresholds
- ✅ Listed assets with chainId, assetId, symbol, decimals
- ✅ ISO datetime strings for all timestamps
- ✅ Smallest units (wei) for amountIn/amountOut

## References

- [CCTP Documentation](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- [CCTP Technical Reference](https://developers.circle.com/stablecoins/docs/cctp-technical-reference)
- [CCTP Protocol Contracts](https://developers.circle.com/stablecoins/docs/cctp-protocol-contract)
- [DefiLlama CCTP Bridge Stats](https://defillama.com/protocol/cctp)
- [Circle USDC Addresses](https://developers.circle.com/stablecoins/docs/usdc-on-main-networks)

## License

Part of the NEAR Intents data collection system.
