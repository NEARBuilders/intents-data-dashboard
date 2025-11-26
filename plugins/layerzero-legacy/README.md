# LayerZero (Stargate) Data Provider Plugin

Production-ready plugin for LayerZero's Stargate protocol. Collects volume, rates, liquidity depth, and supported assets.

## Quick Start

```bash
# Install
bun install

# Configure
cp .env.example .env

# Test
bun test

# Run
bun dev
```

**Test Results:** ✅ 17/17 passing

## Implementation Summary

| Metric | Source | Method |
|--------|--------|--------|
| **Volume** | DefiLlama API | Real on-chain data aggregated from Stargate contracts |
| **Rates** | Stargate API `/quotes` | Live quote requests with fee calculation |
| **Liquidity** | Stargate API `/quotes` | Binary search to find actual slippage thresholds |
| **Assets** | Stargate API `/chains` + `/tokens` | Filter bridgeable tokens |

## Key Features

✅ **Measured Liquidity Depth** - Binary search finds max amounts at 0.5% and 1.0% slippage (not estimated)
✅ **Real Volume Data** - DefiLlama aggregates on-chain transactions (Stargate API has no volume endpoints)
✅ **Error Resilience** - Exponential backoff (1s, 2s, 4s) + rate limiting + graceful degradation
✅ **High Precision** - BigInt arithmetic for decimal normalization
✅ **ENV Configured** - No hardcoded values

## Data Sources

### Volume
**Why DefiLlama?** Stargate REST API does not expose volume endpoints. DefiLlama aggregates real on-chain Stargate contract events across all chains - same source as stargate.finance/overview.

### Liquidity Depth Algorithm
```
1. Get baseline quote (small amount) → reference rate
2. Get srcAmountMax → upper bound
3. Binary search (8 iterations):
   - Test mid-point amount
   - Calculate: slippage = |rate - baseline| / baseline
   - If slippage ≤ threshold: try larger
   - If slippage > threshold: try smaller
4. Return max amount within slippage threshold
```

This measures **actual** slippage, not estimates.

## Configuration

```env
BASE_URL=https://stargate.finance/api/v1
DEFILLAMA_BASE_URL=https://api.llama.fi
TIMEOUT=15000
MAX_REQUESTS_PER_SECOND=10
API_KEY=not-required
```

## Architecture

**Retry Logic:** Exponential backoff with max 3 retries
**Rate Limiting:** Token bucket algorithm
**Error Handling:** Graceful degradation (partial data on failure)
**Caching:** Chain/token metadata cached after first fetch

## Contract Compliance

Implements `every-plugin` contract specification:
- ✅ `getSnapshot(routes, notionals, includeWindows)` → ProviderSnapshot
- ✅ `ping()` → health check
- ✅ All required types (Asset, Rate, LiquidityDepth, VolumeWindow)

## Test Coverage

**Unit Tests (15/15):** Mocked API responses, edge cases, stress tests
**Integration Tests (2/2):** Real API calls to Stargate + DefiLlama

```bash
bun test        # All tests
bun test:watch  # Watch mode
```

## API Endpoints

**Base URL:** `http://localhost:3001`

`POST /snapshot` - Get complete data snapshot
`GET /ping` - Health check

## Supported Chains

Ethereum, Arbitrum, Optimism, Polygon, BNB Chain, Base, Avalanche, Fantom, Metis, and more (15+ chains).

## Author

Built by **0xJesus** for NEAR Intents Data Collection Bounty
