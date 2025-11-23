# Single-Route + Middleware Migration Guide

## Overview

This guide documents the migration to the single-route + middleware architecture for data provider plugins. Each API call for rates/liquidity now accepts a single route instead of arrays of routes, simplifying the API surface and making it easier to implement and test. The pattern has been successfully implemented in `plugins/across`, `plugins/near-intents`, and `plugins/_plugin_template`.

## Architecture: 4-Layer Pattern

### 1. Client Layer (`client.ts`)
- **Purpose**: All HTTP communication with provider APIs
- **Responsibilities**: Rate limiting, retries, timeouts, error handling
- **Framework**: Uses `createHttpClient` from `@data-provider/plugin-utils`
- **Returns**: Raw provider API response formats (no business logic)

### 2. Service Layer (`service.ts`)
- **Purpose**: Business logic and API orchestration
- **Responsibilities**: Data coordination, caching, calculations
- **Framework**: Extends `BaseDataProviderService<ProviderAssetType>`
- **Format**: Works exclusively in provider format (no NEAR Intents transformations)

### 3. Router Layer (`index.ts`)
- **Purpose**: Protocol adaptation between provider and NEAR Intents formats
- **Responsibilities**: Format transformations, middleware setup, handler logic
- **Uses**: oRPC middleware for automatic route transformation
- **Returns**: NEAR Intents format to clients

### 4. Middleware Layer (built-in)
- **Purpose**: Automatic NEAR Intents ⇄ Provider route transformation
- **Created by**: `createTransformRouteMiddleware`
- **Applied to**: `getRates`, `getLiquidity`
- **Provides**: `context.route` (singular) in transformed provider format

---

## Migration Steps

### Phase 1: Create Client Layer

**1. Create `src/client.ts`**
```typescript
import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

export interface {Provider}VolumeResponse {{
  volumes: Array<{{
    window: string;
    volumeUsd: number;
    measuredAt: string;
  }}>;
}}

export const {Provider}Asset = z.object({{
  chainId: z.number(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  priceUsd: z.string().optional(),
}});

export type {Provider}AssetType = z.infer<typeof {Provider}Asset>;

export class {Provider}ApiClient {{
  private readonly http: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeout: number = 30000
  ) {{
    this.http = createHttpClient({{
      baseUrl,
      headers: {{
        'Authorization': apiKey ? `Bearer ${{apiKey}}` : undefined,
        'Content-Type': 'application/json'
      }}.rateLimiter,
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 3
    }});
  }}

  async fetchVolumes(windows: string[]): Promise<VolumeResponse> {{
    return this.http.get<VolumeResponse>('/volumes', {{
      params: {{ windows: windows.join(',') }}
    }});
  }}

  async fetchTokens(): Promise<{Provider}Asset[]> {{
    return this.http.get<{Provider}Asset[]>('/tokens');
  }}

  // Add provider-specific API methods...
}}
```

**2. Move all HTTP logic from service to client**
- No business logic in client
- Only HTTP communication and request/response transformation
- Use `createHttpClient` and `createRateLimiter`

---

### Phase 2: Provider Types

**Note**: With the updated pattern, provider asset types are defined using Zod schemas directly in `client.ts` (see Phase 1). This provides runtime validation of API responses and serves as the source of truth for provider-specific formats.

**Custom ChainId Formats:**
- **Standard (Across, cBridge, deBridge, LiFi)**: `chainId: z.number()`
- **Axelar**: `chainName: z.string()`
- **CCTP**: `domainId: z.string()`

**Provider Type is defined in `client.ts` using Zod:**
```typescript
// Already defined in Phase 1 client.ts:
export const {Provider}Asset = z.object({{ ... }});
export type {Provider}AssetType = z.infer<typeof {Provider}Asset>;
```

---

### Phase 3: Refactor Service Layer

**The Big Change**: Service methods MUST be public and accept provider format.

**✅ CORRECT Service Structure:**
```typescript
import { DataProviderService as BaseDataProviderService } from "@data-provider/plugin-utils";
import { {Provider}ApiClient, ProviderAssetType } from "./client";
import type {
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from "@data-provider/shared-contract";

export class {Provider}Service extends BaseDataProviderService<ProviderAssetType> {
  constructor(private readonly client: {Provider}ApiClient) {
    super();
  }

  // ✅ PUBLIC method, accepts standard TimeWindow[]
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    const response = await this.client.fetchVolumes(windows);
    return response.volumes.map(v => ({
      window: v.window as TimeWindow,
      volumeUsd: v.volumeUsd,
      measuredAt: v.measuredAt
    }));
  }

  // ✅ PUBLIC method, returns ProviderAssetType[] (not canonical format)
  async getListedAssets(): Promise<ProviderAssetType[]> {
    const response = await this.client.fetchTokens();
    return response.map(asset => ({
      chainId: asset.chainId,
      address: asset.address,
      symbol: asset.symbol,
      decimals: asset.decimals,
      priceUsd: asset.priceUsd
    }));
  }

  // ✅ PUBLIC method, accepts SINGLE RouteType<ProviderAssetType> (provider format)
  async getRates(
    route: RouteType<ProviderAssetType>,
    notionals: string[]
  ): Promise<RateType<ProviderAssetType>[]> {
    // Process single route with multiple notionals
    // Business logic here - NO transformations to canonical format
    const rates: RateType<ProviderAssetType>[] = [];
    
    for (const notional of notionals) {
      const quote = await this.client.fetchQuote({
        route,
        amounts: [notional]
      });
      
      rates.push({
        source: route.source,        // ProviderAssetType
        destination: route.destination,  // ProviderAssetType
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        effectiveRate: quote.effectiveRate,
        quotedAt: quote.quotedAt
      });
    }
    
    return rates;
  }

  // ✅ PUBLIC method, accepts SINGLE RouteType<ProviderAssetType>
  async getLiquidityDepth(
    route: RouteType<ProviderAssetType>
  ): Promise<LiquidityDepthType<ProviderAssetType>[]> {
    const response = await this.client.fetchLiquidity({ route });
    
    return [{
      route,
      thresholds: response.thresholds,
      measuredAt: new Date().toISOString()
    }];
  }
}
```

**❌ WRONG Anti-Patterns:**
```typescript
// ❌ Wrong: Private methods (everything needs to be callable from router)
private async getRates(...) { ... }

// ❌ Wrong: Accepts canonical AssetType (service only works with provider formats)
async getRates(route: RouteType<AssetType>, ...) { ... }

// ❌ Wrong: Returns canonical format (transformations happen in router)
async getListedAssets(): Promise<AssetType[]> { ... }

// ❌ Wrong: Accepts array of routes (now single route per call)
async getRates(routes: RouteType<ProviderAssetType>[], ...) { ... }
```

---

### Phase 4: Create Router Layer with Middleware

**Update `src/index.ts`**
```typescript
import {{ createPlugin }} from "every-plugin";
import {{ Effect }} from "every-plugin/effect";
import {{ z }} from "every-plugin/zod";
import {{
  createTransformRoutesMiddleware,
  getBlockchainFromChainId,
  getChainId,
  transformRate,
  transformLiquidity
}} from "@data-provider/plugin-utils";

import {{ {Provider}ApiClient }} from "./client";
import {{ contract }} from "./contract";
import {{ {Provider}Service }} from "./service";
import type {{ AssetType, {Provider}AssetType }} from "./contract";

export default createPlugin({{
  variables: z.object({{
    baseUrl: z.string().url().default("https://api.{provider}.com"),
    timeout: z.number().min(1000).max(60000).default(30000),
  }}),

  secrets: z.object({{
    apiKey: z.string().default("not-required"),
  }}),

  contract,

  initialize: (config) => Effect.gen(function* () {{
    // Create HTTP client
    const client = new {Provider}ApiClient(
      config.variables.baseUrl,
      config.secrets.apiKey,
      config.variables.timeout
    );

    // Create service
    const service = new {Provider}Service(client);

    // NEAR Intents → Provider transformation
    const transformAssetToProvider = async (asset: AssetType): Promise<{Provider}AssetType> => {{
      const chainId = await getChainId(asset.blockchain);
      if (!chainId) {{
        throw new Error(`Unsupported blockchain: ${{asset.blockchain}}`);
      }}
      return {{
        chainId: chainId,
        address: asset.contractAddress!,
        symbol: asset.symbol,
        decimals: asset.decimals
      }};
    }};

    // Provider → NEAR Intents transformation
    const transformAssetFromProvider = async (asset: {Provider}AssetType): Promise<AssetType> => {{
      let blockchain = await getBlockchainFromChainId(String(asset.chainId));

      if (!blockchain) {{
        // Handle provider-specific mappings
        switch (String(asset.chainId)) {{
          case "34268394551451": // Solana example
            blockchain = "sol";
            break;
          default:
            throw new Error(`Unknown chainId: ${{asset.chainId}}`);
        }}
      }}

      const assetId = asset.address
        ? `nep141:${{blockchain}}-${{asset.address.toLowerCase()}}.omft.near`
        : `nep141:${{asset.symbol}}`;

      return {{
        blockchain,
        assetId,
        symbol: asset.symbol,
        decimals: asset.decimals,
        contractAddress: asset.address
      }};
    }};

    return {{ service, transformAssetToProvider, transformAssetFromProvider }};
  }}),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {{
    const {{ service, transformAssetToProvider, transformAssetFromProvider }} = context;

    // Create middleware for route transformation
    const transformRoutesMiddleware = createTransformRoutesMiddleware<
      AssetType,
      {Provider}AssetType
    >(transformAssetToProvider);

    return {{
      // No middleware - accepts standard inputs
      getVolumes: builder.getVolumes.handler(async ({{ input }}) => {{
        const volumes = await service.getVolumes(input.includeWindows || ["24h"]);
        return {{ volumes }};
      }}),

      // No middleware - transforms provider assets to NEAR Intents
      getListedAssets: builder.getListedAssets.handler(async () => {{
        const providerAssets = await service.getListedAssets();
        const assets = await Promise.all(
          providerAssets.map(asset => transformAssetFromProvider(asset))
        );
        return {{
          assets,
          measuredAt: new Date().toISOString()
        }};
      }}),

      // WITH middleware - accepts canonical route, transforms to provider format
      // Middleware provides context.route (singular) in provider format
      getRates: builder.getRates.use(transformRoutesMiddleware).handler(async ({{ input, context }}) => {{
        if (!context.route) {{
          return {{ rates: [] }};
        }}
        const providerRates = await service.getRates(context.route, input.notionals);
        const rates = await Promise.all(
          providerRates.map(r => transformRate(r, transformAssetFromProvider))
        );
        return {{ rates }};
      }}),

      getLiquidity: builder.getLiquidity.use(transformRoutesMiddleware).handler(async ({{ input, context }}) => {{
        if (!context.route) {{
          return {{ liquidity: [] }};
        }}
        const providerLiquidity = await service.getLiquidityDepth(context.route);
        const liquidity = await Promise.all(
          providerLiquidity.map(l => transformLiquidity(l, transformAssetFromProvider))
        );
        return {{ liquidity }};
      }}),

      ping: builder.ping.handler(async () => ({{
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      }})),
    }};
  }}
}});
```

---

## When Documentation Is Unclear

If you're unsure about API endpoints or data formats during migration:

1. **Check existing implementation** - Look at current service.ts for API usage patterns
2. **Avoid initialization network calls** - Don't add health checks during plugin initialization
3. **Consult provider documentation directly**
4. **Preserve existing behavior** - When in doubt, keep the same API calls that work
5. **Ask for clarification** - If multiple interpretations exist, ask about the correct approach

---

## Critical Anti-Patterns

### ❌ Don't Call Health Checks During Initialization

**Problem**: Some providers don't have health check endpoints, causing plugin initialization to fail.

**Wrong:**
```typescript
initialize: (config) => Effect.gen(function* () {
  const client = new SomeClient(config);
  // ❌ This fails if the API doesn't have this endpoint
  yield* Effect.tryPromise(() => client.healthCheck());
  return { service };
})
```

**Correct:**
```typescript
initialize: (config) => Effect.gen(function* () {
  const client = new SomeClient(config);
  const service = new SomeService(client);
  // ✅ Keep initialization lightweight - no network calls
  return { service };
})
```

**Why this matters**: Plugin loading fails during tests and deployment if health checks fail. Keep initialization synchronous and fast.

### 9. Handle Unsupported Chains Gracefully in Transformations

**Problem**: Provider APIs may return assets on chains not supported by NEAR Intents mapping.

**Wrong:**
```typescript
// Throws and fails entire operation
const transformAssetFromProvider = async (asset: ProviderAssetType) => {
  const blockchain = await getBlockchainFromChainId(String(asset.chainId));
  if (!blockchain) {
    throw new Error(`Unknown chainId: ${asset.chainId}`); // 💥 BOOM
  }
  return assetInNEARFormat;
};
```

**Correct:**
```typescript
// Log warning and skip unsupported chains
const transformAssetFromProvider = async (asset: ProviderAssetType) => {
  const blockchain = await getBlockchainFromChainId(String(asset.chainId));
  if (!blockchain) {
    // Handle known unsupported chains specifically
    switch (asset.chainId) {
      case 1990: // Elrond testnet
        console.warn(`Skipping unsupported Elrond testnet: ${asset.chainId}`);
        throw new Error(`Unsupported chainId: ${asset.chainId}`);
      default:
        console.warn(`Unknown chainId: ${asset.chainId}, skipping asset`);
        throw new Error(`Unsupported chainId: ${asset.chainId}`);
    }
  }
  return assetInNEARFormat;
};

// In router handlers, use Promise.allSettled to filter out failures
getListedAssets: builder.getListedAssets.handler(async () => {
  const providerAssets = await service.getListedAssets();

  const assetResults = await Promise.allSettled(
    providerAssets.map(asset => transformAssetFromProvider(asset))
  );

  const assets = assetResults
    .filter((result): result is PromiseFulfilledResult<AssetType> =>
      result.status === 'fulfilled'
    )
    .map(result => result.value);

  console.log(`Transformed ${assets.length}/${providerAssets.length} assets`);
  return { assets, measuredAt: new Date().toISOString() };
}),
```

**Why this matters**: Provider APIs change frequently. Handle unsupported chains gracefully instead of failing entire operations.

### 10. Return Specific Thresholds, Not All Matching Amounts

**Problem**: Liquidity tests expect exactly 2 thresholds (50bps, 100bps) but services return all amounts that fit criteria.

**Wrong:**
```typescript
// Returns 1, 2, 3, or 4 thresholds depending on what fits
for (const amount of testAmounts) {
  if (slippage <= 50) thresholds.push({ maxAmountIn: amount, slippageBps: 50 });
  if (slippage <= 100) thresholds.push({ maxAmountIn: amount, slippageBps: 100 });
}
return { thresholds }; // Could be 0, 2, 4, 6, 8 thresholds
```

**Correct:**
```typescript
// Return exactly 2 specific thresholds
let recommendedAmount: string | null = null;
let maxAmount: string | null = null;

// Find largest amounts that fit within 50bps and 100bps respectively
for (const amount of testAmounts) {
  const data = await fetchEstimate(amount);
  const slippage = calculateSlippage(amount, data.out);

  if (slippage <= 50 && recommendedAmount === null) {
    recommendedAmount = amount; // Largest <= 50bps
  }
  if (slippage <= 100 && maxAmount === null) {
    maxAmount = amount; // Largest <= 100bps
  }
}

return {
  thresholds: [
    { maxAmountIn: recommendedAmount, slippageBps: 50 },
    { maxAmountIn: maxAmount, slippageBps: 100 }
  ]
};
```

**Why this matters**: Contract compliance requires specific threshold definitions, not arbitrary lists.

---

## Provider-Specific Considerations

### Network ID Formats

**Most Providers (ChainId as Number):**
- Across, cBridge, deBridge, Li.Fi
- Ethereum Mainnet: `1`
- Polynomial/Scroll: `534352`/`534353`

**Custom Providers:**
- **Axelar**: Uses `chainName: "ethereum" | "polygon" | ...`
- **CCTP**: Uses `domainId: "0" (Ethereum) | "2" (Optimism) | ...`

### Asset ID Format

Assets MUST follow this exact format:
```typescript
// ✅ Correct
assetId: `nep141:${{blockchain}}-${{address.toLowerCase()}}.omft.near`


// ❌ Wrong (missing omft.near)
assetId: `nep141:${{blockchain}}-${{address}}`

// ❌ Wrong (missing blockchain)  
assetId: `nep141:${{address}}.omft.near`
```

---

## Migration Checklist

### Client Layer
- [ ] `src/client.ts` exists
- [ ] Uses `createHttpClient` and `createRateLimiter`
- [ ] All HTTP calls moved from service to client
- [ ] Returns raw provider API formats

### Contract Layer
- [ ] `src/contract.ts` has provider-specific schemas
- [ ] Field names match actual provider API responses
- [ ] Exports `{Provider}AssetType` and `{Provider}RouteType`

### Service Layer
- [ ] Extends `BaseDataProviderService<{Provider}AssetType>`
- [ ] Constructor injects client
- [ ] **All methods are PUBLIC**
- [ ] `getListedAssets()` returns `{Provider}AssetType[]`
- [ ] `getRates()` accepts single `RouteType<{Provider}AssetType>` (not array)
- [ ] `getLiquidityDepth()` accepts single `RouteType<{Provider}AssetType>` (not array)
- [ ] No canonical format transformations

### Router Layer
- [ ] Uses `createProviderRouter` from `@data-provider/plugin-utils` (recommended)
- [ ] OR manually implements transformation logic with Effect for reliability
- [ ] Middleware created with `createTransformRouteMiddleware` provides `context.route`
- [ ] Handlers check `if (!context.route)` and return empty arrays when route is missing
- [ ] Routes without route param (`getVolumes`, `getListedAssets`) have no middleware
- [ ] Routes with route param (`getRates`, `getLiquidity`) have middleware
- [ ] All responses are in canonical format

### Testing
- [ ] `npm test` passes (assuming tests already migrated)
- [ ] Contract compliance tests pass
- [ ] Integration tests cover all endpoints

---

## Success Indicators

Migration is complete when:
- ✅ Plugin follows template structure exactly
- ✅ Service methods call client, not HTTP directly
- ✅ Service works in provider format only
- ✅ Service methods accept single route (not arrays)
- ✅ Router handles all canonical format transformations
- ✅ Middleware provides `context.route` (singular) in provider format
- ✅ All endpoints return canonical format
- ✅ Tests pass and plugin loads successfully

---

## Reference

See `plugins/_plugin_template`, `plugins/across`, and `plugins/near-intents` for canonical implementations of this pattern. All plugins should match this structure, customizing only:
1. Provider-specific asset type in `client.ts` (exported as `ProviderAssetType`)
2. API method implementations in `client.ts` 
3. Business logic in `service.ts` (single route processing in provider format)
4. ChainId or other identifier mappings in transformation functions

## Key Differences from Previous Architecture

**Before (Multi-Route):**
- `getRates(routes: RouteType[], notionals: string[])`
- `getLiquidity(routes: RouteType[])`
- Middleware provided `context.routes` (array)
- Service processed multiple routes per call

**After (Single-Route):**
- `getRates(route: RouteType, notionals: string[])`
- `getLiquidity(route: RouteType)`
- Middleware provides `context.route` (singular, optional)
- Service processes one route per call
- Simpler to implement and test
- Better error isolation per route
