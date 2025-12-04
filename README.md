![NEAR Intents - Competitor Comparison](apps/web/public/metadata.png)

A dashboard for all things NEAR intents, providing bridge data and analytics across multiple providers.

**Live deployment:** [compareintents.xyz](https://compareintents.xyz)

## Repository Structure

- **apps/server**: Main API aggregating data from all bridge providers via plugins
- **apps/canonical-asset-service**: Asset management service with scheduled data synchronization
- **apps/web**: Frontend dashboard for comparing bridge providers (Next.js/React)
- **apps/gateway**: Caddy reverse proxy for routing requests
- **plugins/**: Individual data provider implementations (bridge-specific integrations)
- **packages/**: Shared utilities and core orchestration logic

## Plugins & Packages

**Plugins** (`plugins/*`) are standalone implementations for each bridge provider (e.g., `across`, `lifi`, `wormhole`). Each plugin implements the data provider interface defined by `@data-provider/shared-contract`.

**Packages** (`packages/*`) contain shared logic:
- `packages/api`: Registers and initializes all plugins, acting as the orchestration layer between `apps/server` and individual plugins
- `packages/plugin-utils`: Provides common utilities (HTTP client with rate limiting, decimal math) used by plugins
- `packages/shared-contract`: Defines the contract/interface that all plugins must implement

**Flow**: Plugins are developed independently in `plugins/`, registered in `packages/api/src/plugins.ts`, then consumed by `apps/server` which exposes the aggregated data through its API.

## Development

```bash
# Start docker (Redis for cache)
docker compose up -d

# Install dependencies
bun install

# Start development
bun run dev            # Start web + server
```

The web UI will be available at `http://localhost:3001`

## Contributing

### Adding a New Provider

1. **Generate plugin from template**:

   ```bash
   bun run generate
   ```

   Follow the prompts to create a new plugin.

2. **Implement the data provider methods** in `src/service.ts`:
   - `getVolumes()` - Fetch volume metrics for time windows
   - `getListedAssets()` - Return all supported assets
   - `getRates()` - Get exchange rate quotes
   - `getLiquidityDepth()` - Measure liquidity depth at slippage thresholds

3. **Register your plugin** in `packages/api/src/plugins.ts`:
   - Add your plugin to the `PLUGIN_URLS` configuration
   - Import and add type declaration
   - Include in `initializePlugins()` function

4. **Test your implementation**:

   ```bash
   cd plugins/your-provider
   bun run test
   ```

## License

Part of the NEAR Intents data collection system.
