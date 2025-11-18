# Data Provider Plugin Template

Template for building single-provider bridge data adapters for the NEAR Intents data collection system.

## Quick Start

1. **Choose one provider**: LayerZero, Wormhole, CCTP, Across, deBridge, Axelar, or Li.Fi

2. **Copy template**:

   ```bash
   cp -r packages/_plugin_template packages/your-provider-plugin
   cd packages/your-provider-plugin
   ```

3. **Replace mock implementation** in `src/service.ts`:
   - Replace `getRates()`, `getVolumes()`, `getLiquidityDepth()`, `getListedAssets()` with real API calls
   - Implement decimal normalization for `effectiveRate` calculations
   - Add proper error handling for rate limits and timeouts

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

Tests pass with mock implementation and serve as validation checkpoints for your real provider API.

## Environment Variables

```bash
# Required
DATA_PROVIDER_API_KEY=your_provider_api_key

# Optional
DATA_PROVIDER_BASE_URL=https://api.yourprovider.com
DATA_PROVIDER_TIMEOUT=10000
```

## Contract

Single endpoint `getSnapshot` that takes routes, notional amounts, and time windows, returning:

- **volumes**: Trading volume for 24h/7d/30d windows
- **rates**: Exchange rates and fees for each route/notional
- **liquidity**: Max input amounts at 50bps and 100bps slippage
- **listedAssets**: Supported assets on the provider

## Notes

- **One provider per plugin** - Implement only the provider you chose
- **No background processing** - Simple request/response pattern
- **Template injection** - Use `{{SECRET_NAME}}` for secrets in runtime config
- **Error resilience** - Implement retries and rate limiting in your service methods

## License

Part of the NEAR Intents data collection system.
