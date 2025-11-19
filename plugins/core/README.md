# Data Provider Plugin Template

Template for building single-provider bridge data adapters for the NEAR Intents data collection system.

## Quick Start

1. **Choose one provider**: LayerZero, Wormhole, CCTP, Across, deBridge, Axelar, or Li.Fi

2. **Copy template**:

   ```bash
   cp -r plugins/_plugin_template plugins/your-provider-plugin
   cd plugins/your-provider-plugin
   ```

3. **Update configuration** in `plugin.dev.ts`:
   - Set your plugin's secrets and variables
   - Update `sampleRoute` with a real route for your provider
   - Configure any secrets in your .env

4. **Implement provider** in `src/service.ts`:
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

## Understanding Tests

Tests validate your implementation with **clear failure messages** when incomplete.

### Expected Test Behavior

**With Empty Template Implementation:**

- ❌ 3/4 unit tests fail with actionable error messages
- ❌ 1/2 integration tests fail
- Each failure tells you which method to implement

**With Working Implementation:**

- ✅ All tests pass
- 📊 Console displays data quality metrics for easy review

### Test Output Example

When tests pass with a real implementation, you'll see:

```bash
📊 Volume Data & Listed Assets
   ✓ Unique Assets: 12
   ✓ Volume (24h): $1,234,567
   ✓ Volume (7d):  $8,901,234
   ✓ Volume (30d): $35,678,901

📊 Rate Validation
   ✓ Unique Assets: 12
   ✓ Volume (24h): $1,234,567
   ✓ Rates: 4 quotes (avg: 0.9998)

📊 Liquidity Depth
   ✓ Unique Assets: 12
   ✓ Liquidity: 2 routes measured
```

This makes it easy to review multiple plugin implementations quickly.

### Common Test Failures

**"No volume data returned"**
→ Implement `getVolumes()` in `src/service.ts` to fetch volume metrics

**"No assets returned"**
→ Implement `getListedAssets()` in `src/service.ts` to return supported assets

**"Expected rates to be present"**
→ Implement `getRates()` to fetch quotes for given routes and notionals

**"Expected liquidity to be present"**
→ Implement `getLiquidityDepth()` to measure max amounts at 50bps and 100bps slippage

## Contract

Single endpoint `getSnapshot` that takes routes, notional amounts, and time windows, returning:

- **volumes**: Trading volume for 24h/7d/30d windows
- **rates**: Exchange rates and fees for each route/notional
- **liquidity**: Max input amounts at 50bps and 100bps slippage
- **listedAssets**: Supported assets on the provider

## Notes

- **One provider per plugin** - Implement only the provider you chose
- **No background processing** - Simple request/response pattern
- **Error resilience** - Implement retries and rate limiting in your service methods

## License

Part of the NEAR Intents data collection system.
