# Intents Dashboard Bounty – TODO

## 1. Migrate Existing Plugins to Multi-Route + Middleware Pattern

### 1.1. Verify reference implementations
- [x] Use `plugins/_plugin_template` as canonical structure
- [x] Use `plugins/across` as canonical *real* provider implementation
- [ ] Cross-check `MIGRATION_GUIDE.md` against current across implementation and template for any divergences to document

### 1.2. Fix and finalize `cbridge` migration (tests failing)
- [ ] Run `plugins/cbridge` tests and document failing specs (unit + integration)
- [ ] Align `cbridge` implementation with migration pattern:
  - [ ] `src/client.ts`: HTTP-only logic (rate limiting, retries, timeouts) using `@data-provider/plugin-utils`
  - [ ] `src/contract.ts`: provider-specific `ProviderAsset`, `ProviderRoute`, and re-export shared `contract`
  - [ ] `src/service.ts`: extend `BaseDataProviderService<ProviderAssetType>` and expose **public** `getVolumes`, `getListedAssets`, `getRates`, `getLiquidityDepth`, `getSnapshot` in **provider format only**
  - [ ] `src/index.ts`: router + middleware using `createTransformRoutesMiddleware`, `transformAssetToProvider`, `transformAssetFromProvider`
- [ ] Ensure provider-specific behaviors are correct:
  - [ ] Volumes: intentionally return empty list (no public cBridge volume API) but keep types correct
  - [ ] Rates: use official `v2/estimateAmt`, normalize decimals, compute effective rate & fees
  - [ ] Liquidity depth: respect contract expectations (exact two thresholds 50bps/100bps)
  - [ ] Listed assets: ensure chain IDs, addresses, decimals map correctly

### 1.3. Migrate `debridge` to new pattern
(Currently monolithic-style service; already has rich logic.)
- [ ] Refactor to 4-layer architecture:
  - [ ] Introduce `src/client.ts` and move all raw HTTP calls there
  - [ ] Create `src/contract.ts` with `ProviderAsset`/`ProviderRoute` matching DLN API
  - [ ] Update `src/service.ts` to operate purely in provider format and expose standard methods
  - [ ] Update `src/index.ts` to use middleware pattern & transformation helpers
- [ ] Ensure deBridge-specific logic survives refactor:
  - [ ] Volume via stats API
  - [ ] Route-intelligence / probing logic for liquidity and fee scores
  - [ ] Caching and rate limiting

### 1.4. Migrate `cctp` to new pattern
- [ ] Introduce client/service/router split as per template
  - [ ] `client.ts`: Circle Iris API + DefiLlama bridge API calls
  - [ ] `contract.ts`: domainId-based provider asset schema (CCTP uses domains rather than EVM chain IDs)
  - [ ] `service.ts`: implement volumes, rates (fee-based 1:1 USDC transfers), liquidity (fast allowance vs standard)
  - [ ] `index.ts`: chain-domain mapping in transforms, middleware for routes, asset ID formatting
- [ ] Ensure:
  - [ ] USDC-only enforcement and unsupported assets/blocks are handled gracefully
  - [ ] Proper assetId format: `nep141:${blockchain}-${address.toLowerCase()}.omft.near`

### 1.5. Migrate `lifi` to new pattern
- [ ] Refactor LiFi adapter to client/service/router:
  - [ ] `client.ts`: `/tokens`, `/quote`, `/v2/analytics/transfers` HTTP layer only
  - [ ] `contract.ts`: provider asset & route schemas keyed by LiFi chain IDs
  - [ ] `service.ts`: implement volume (analytics), rates, liquidity (binary search), assets
  - [ ] `index.ts`: route transforms, proper chainId↔blockchain mapping, middleware for routes

### 1.6. Migrate `axelar` to new pattern
- [ ] Introduce multi-route pattern around existing Axelar implementation:
  - [ ] `client.ts`: Axelarscan + AxelarJS SDK calls
  - [ ] `contract.ts`: axelar chainName–style identifiers (if used) and asset schema
  - [ ] `service.ts`: implement volumes, rates, liquidity, listed assets on provider format
  - [ ] `index.ts`: map chainName ↔ NEAR blockchain IDs, middleware
- [ ] Ensure Axelar-specific behaviors:
  - [ ] Fee calculation via Axelar SDK preserved
  - [ ] Asset discovery through `getAssets`/`getChains` preserved

### 1.7. Migrate `layerzero` (Stargate) to new pattern
- [ ] Factor existing plugin into template layers:
  - [ ] `client.ts`: Stargate API + DefiLlama; timeouts, retries, rate limiting
  - [ ] `contract.ts`: Stargate chain ID and token schemas
  - [ ] `service.ts`: existing binary search liquidity logic & volume logic in provider format
  - [ ] `index.ts`: route transforms using shared utils; middleware on `getRates`, `getLiquidity`, `getSnapshot`
- [ ] Ensure slippage-based liquidity thresholds (0.5%/1.0%) are still correct and conform to shared contract

### 1.8. Migrate `wormhole` to new pattern
(Currently still a template-like plugin.)
- [ ] Design provider format and APIs to use:
  - [ ] Choose official Wormhole/Wormholescan endpoints for transfers, assets, etc.
  - [ ] Decide scope: bridge-only, or also GMP metrics
- [ ] Implement full plugin:
  - [ ] `client.ts`: Wormholescan HTTP client
  - [ ] `contract.ts`: provider asset/route schemas (chain IDs or Wormhole chain IDs)
  - [ ] `service.ts`: implement volumes, rates (if possible), liquidity depth (or document limitations), listed assets
  - [ ] `index.ts`: route transforms, middleware, assetId mapping

---

## 2. New Provider Plugins

All new provider plugins must:
- Extend `DataProviderService<ProviderAssetType>` from `@data-provider/plugin-utils` in `src/service.ts`
- Use the 4-layer pattern from `MIGRATION_GUIDE.md` and `plugins/_plugin_template`:
  - `client.ts` – HTTP-only layer (rate limiting, retries, timeouts)
  - `contract.ts` – provider asset/route schemas + re-export shared `contract`
  - `service.ts` – business logic in provider format, extending `DataProviderService`
  - `index.ts` – NEAR Intents ⇄ provider transforms + middleware via `createTransformRoutesMiddleware`

### 2.1 New Plugin: Mayan
- [ ] Classify Mayan (Aggregator vs Bridge) and add to provider metadata
- [ ] Research official Mayan API for:
  - [ ] Volume / historical stats (or decide on third-party like DefiLlama vs `[]`)
  - [ ] Quote/routing (rates + fees)
  - [ ] Supported assets and chains
  - [ ] Any liquidity or limit endpoints
- [ ] Scaffold plugin from `plugins/_plugin_template` into `plugins/mayan`:
  - [ ] `contract.ts`: define `ProviderAsset`/`ProviderRoute` matching Mayan's format
  - [ ] `client.ts`: implement HTTP client using `createHttpClient` + `createRateLimiter`
  - [ ] `service.ts`: extend `DataProviderService<ProviderAssetType>` and implement:
    - [ ] `getVolumes`
    - [ ] `getListedAssets`
    - [ ] `getRates`
    - [ ] `getLiquidityDepth`
    - [ ] `getSnapshot`
  - [ ] `index.ts`: implement `transformAssetToProvider` / `transformAssetFromProvider` and wire middleware for `getRates`, `getLiquidity`, `getSnapshot`
- [ ] Wire Mayan into `packages/api/src/plugins.ts` registry and `routers/index.ts` under `/providers/mayan`

### 2.2 New Plugin: Relay
- [ ] Classify Relay (Aggregator/Bridge) and add to provider metadata
- [ ] Research official Relay API (or SDK) for volume, quotes, assets, liquidity
- [ ] Scaffold `plugins/relay` from template
- [ ] `service.ts`: extend `DataProviderService<ProviderAssetType>` and implement standard methods
- [ ] Implement `client.ts`, `contract.ts`, `index.ts` following the same pattern as Mayan
- [ ] Wire Relay into `plugins.ts` registry and `routers/index.ts` under `/providers/relay`

### 2.3 New Plugin: Everclear
- [ ] Classify Everclear (Clearing) and add to provider metadata
- [ ] Research APIs for settlement/clearing volume, supported assets, and any quote-like endpoints
- [ ] Scaffold `plugins/everclear` from template
- [ ] `service.ts`: extend `DataProviderService<ProviderAssetType>` and implement standard methods (document any metrics that are inherently unavailable)
- [ ] Implement `client.ts`, `contract.ts`, `index.ts` as above
- [ ] Wire Everclear into `plugins.ts` and `routers/index.ts` under `/providers/everclear`

### 2.4 New Plugin: Hyperlane
- [ ] Classify Hyperlane (GMP/Bridge) and add to metadata
- [ ] Research Hyperlane APIs / indexers for volume, routes, assets, and any fee/rate info
- [ ] Scaffold `plugins/hyperlane` from template
- [ ] `service.ts`: extend `DataProviderService<ProviderAssetType>` and implement standard methods
- [ ] Implement `client.ts`, `contract.ts`, `index.ts` (including any special chain ID mapping Hyperlane uses)
- [ ] Wire Hyperlane into `plugins.ts` and `routers/index.ts` under `/providers/hyperlane`

### 2.5 New Plugin: Chainflip
- [ ] Classify Chainflip (Bridge / DEX-style bridge) and add to metadata
- [ ] Research Chainflip APIs for on-chain pools, volume, routes, and fee structure
- [ ] Scaffold `plugins/chainflip` from template
- [ ] `service.ts`: extend `DataProviderService<ProviderAssetType>` and implement standard methods
- [ ] Implement `client.ts`, `contract.ts`, `index.ts` with any AMM-specific logic for liquidity depth
- [ ] Wire Chainflip into `plugins.ts` and `routers/index.ts` under `/providers/chainflip`

### 2.6 New Plugin: Cashmere
- [ ] Classify Cashmere (Bridge / Liquidity layer) and add to metadata
- [ ] Research Cashmere APIs for volume, supported assets, routing, and pool depth
- [ ] Scaffold `plugins/cashmere` from template
- [ ] `service.ts`: extend `DataProviderService<ProviderAssetType>` and implement standard methods
- [ ] Implement `client.ts`, `contract.ts`, `index.ts` as above
- [ ] Wire Cashmere into `plugins.ts` and `routers/index.ts` under `/providers/cashmere`

### 2.7 New Plugin: Bungee
- [ ] Classify Bungee (Aggregator) and add to metadata
- [ ] Research Bungee APIs (or underlying provider) for routes, quotes, assets, and any available volume/liquidity data
- [ ] Scaffold `plugins/bungee` from template
- [ ] `service.ts`: extend `DataProviderService<ProviderAssetType>` and implement standard methods
- [ ] Implement `client.ts`, `contract.ts`, `index.ts` following the shared pattern
- [ ] Wire Bungee into `plugins.ts` and `routers/index.ts` under `/providers/bungee`

---

## 3. API Aggregation & Routers

### 3.1. Wire all plugins into `packages/api/src/plugins.ts`
- [ ] Enable all providers in the plugin registry:
  - [ ] Uncomment and configure `@data-provider/axelar`
  - [ ] Uncomment and configure `@data-provider/cbridge`
  - [ ] Uncomment and configure `@data-provider/cctp`
  - [ ] Uncomment and configure `@data-provider/debridge`
  - [ ] Uncomment and configure `@data-provider/layerzero`
  - [ ] Uncomment and configure `@data-provider/lifi`
  - [ ] Uncomment and configure `@data-provider/wormhole`
  - [ ] Add new providers (Mayan, Relay, Stargate, Everclear, Hyperlane, Chainflip, Cashmere, Bungee) once plugins exist
- [ ] Ensure environment-specific URLs are correct:
  - [ ] Local dev: `PLUGIN_URLS.development` ports match each plugin's `plugin.dev.ts`
  - [ ] Production: Zephyr remote URLs are up-to-date
- [ ] Standardize environment variables per plugin:
  - [ ] `*_BASE_URL`
  - [ ] Timeouts & rate limit knobs
  - [ ] API keys if needed

### 3.2. Extend `packages/api/src/routers/index.ts`
- [ ] Expose all providers under `/providers/{id}`
  - [ ] Add router prefixes for all migrated + new providers (mirroring commented-out across pattern)
- [ ] Improve aggregated `/snapshot` endpoint:
  - [ ] Support filtering by category (Aggregator/Bridge/Clearing/GMP) as well as explicit provider IDs
  - [ ] Ensure it forwards `routes`, `notionals`, and `includeWindows` to each provider's `getSnapshot`
  - [ ] Decide on behavior when some providers error (current Promise.allSettled → partial success); document this
- [ ] Optionally add lightweight discovery endpoints:
  - [ ] `/providers` → list provider IDs + categories + basic info
  - [ ] `/providers/{id}/assets` → federated call to `getListedAssets`

---

## 4. Publishing API & Dashboard Consumption

### 4.1. API contract for consumers
- [ ] Document request & response shapes for:
  - [ ] `/snapshot` (aggregated)
  - [ ] `/providers/{id}/snapshot` (per provider)
  - [ ] `/providers/{id}/assets`
  - [ ] Any discovery endpoints
- [ ] Clarify semantics:
  - [ ] Time windows: `24h`, `7d`, `30d`
  - [ ] Units: amounts in smallest units, volume in USD, fees in USD
  - [ ] Handling of missing metrics (e.g. provider returns `[]` volumes)
- [ ] Provide example queries for other dashboards to integrate (curl + TypeScript client examples)

### 4.2. Performance and reliability baseline
- [ ] Define acceptable latency & error targets for the aggregated snapshot endpoint
- [ ] Add basic logging/observability around:
  - [ ] Per-provider latency & error rates
  - [ ] Overall snapshot latency

---

## 5. Contributing Guide for Adding a Plugin

### 5.1. Author the contributing guide
- [ ] Create `CONTRIBUTING.md` with a dedicated section for adding plugins
