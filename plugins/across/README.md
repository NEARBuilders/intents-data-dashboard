# Across Protocol Data Provider

Fast, reliable bridge data from Across Protocol for NEAR Intents.

## Quick Verify

```bash
npm install && npm test    # 47/47 tests pass ✅
```

## What It Does

| Metric | Data Source | API Endpoint |
|--------|-------------|--------------|
| **Volume** | DefiLlama | `GET /bridge/across` |
| **Rates/Fees** | Across API | `GET /suggested-fees` |
| **Liquidity** | Across API | `GET /limits` |
| **Assets** | Across API | `GET /swap/tokens` |

## Setup

**No API key needed** - Across API is public.

```bash
# 1. Install
npm install

# 2. Configure (optional)
cp .env.example .env

# 3. Test
npm test

# 4. Build
npm run build
```

## Configuration

Optional environment variables:

```bash
BASE_URL=https://app.across.to/api
TIMEOUT=60000                     # 60 seconds
MAX_REQUESTS_PER_SECOND=5         # Rate limit
```

## How Data is Derived

### Volume (24h, 7d, 30d)
```
GET https://bridges.llama.fi/bridge/19
├─ lastDailyVolume → 24h window ($33.3M)
├─ weeklyVolume    → 7d window ($241.3M)
└─ monthlyVolume   → 30d window ($1.06B)
```

**Why DefiLlama:** Across API doesn't expose historical volume publicly. Note: Bridge ID is numeric (19), not string.

### Rate Quotes
```
GET /suggested-fees?inputToken=X&outputToken=Y&amount=Z
└─ relayFeeTotal (fees in wei)

Calculation:
  amountOut = amountIn - relayFeeTotal
  effectiveRate = (amountOut / 10^dstDecimals) / (amountIn / 10^srcDecimals)
  totalFeesUsd = (relayFeeTotal / 10^decimals) × tokenPriceUsd
```

### Liquidity Depth
```
GET /limits?inputToken=X&outputToken=Y
├─ recommendedDepositInstant → 50 bps threshold (0.5%)
└─ maxDepositInstant         → 100 bps threshold (1.0%)

Note: Values kept in smallest units (wei) per contract specification.
Example: "55422076520" = 55,422 USDC (6 decimals)
```

**Why these thresholds:** Based on Across instant fill vs slow fill limits.

### Available Assets
```
GET /swap/tokens
└─ Returns: [{ chainId, address, symbol, decimals, priceUsd }]
```

Coverage: 20+ chains, 1200+ tokens

## Features

✅ **Real data only** - No estimates or hardcoded values
✅ **Retry logic** - 3 attempts with exponential backoff (1s, 2s, 4s)
✅ **Rate limiting** - Token bucket algorithm
✅ **Parallel fetching** - All metrics fetched concurrently
✅ **Smart caching** - 5min (prices), 10min (volumes)
✅ **Graceful degradation** - Returns partial data if some APIs fail
✅ **Type safe** - Full TypeScript with proper error handling

## Test Coverage

```bash
npm test
```

**47/47 tests passing:**
- ✅ Contract compliance (field names, types unchanged)
- ✅ Volume metrics (all time windows)
- ✅ Rate calculation (decimal normalization, wei precision)
- ✅ Liquidity thresholds (50bps and 100bps required)
- ✅ Asset listing (chainId, decimals correct)
- ✅ Error handling (retries, rate limits, partial failures)
- ✅ Real API integration (no mocks)

## Architecture

```
getSnapshot()
    ├─ Rate Limiter (Token Bucket)
    └─ Promise.all([
         fetchVolumes()    → DefiLlama + 3 retries + 10min cache
         fetchRates()      → Across API + 3 retries
         fetchLiquidity()  → Across API + 3 retries
         fetchAssets()     → Across API + 3 retries
       ])
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests fail | Check network, verify API URLs are correct |
| Empty volumes | DefiLlama may be down (gracefully handled) |
| No prices | Falls back Across→CoinGecko, returns `null` if both fail |
| Rate limit errors | Increase `MAX_REQUESTS_PER_SECOND` or add delays |

## API References

- [Across API Docs](https://docs.across.to/reference/api-reference)
- [DefiLlama Bridge API](https://defillama.com/docs/api)
- [Contract Specification](..ts)

## License

MIT
