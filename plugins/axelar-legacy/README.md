# Axelar Data Provider Plugin

Fully implemented Axelar bridge data provider plugin using the AxelarJS SDK and Axelarscan API. This plugin provides real-time data for cross-chain transfers via Axelar network.

## Features

✅ **Real Volume Data** - Fetches actual transfer volumes from Axelarscan API  
✅ **1910+ Assets** - Dynamically loads all assets across 82+ chains  
✅ **Rate Quotes** - Calculates transfer rates with Axelar network fees  
✅ **Liquidity Depth** - Estimates max amounts at 50bps and 100bps slippage  
✅ **Rate Limiting** - Built-in token bucket rate limiter for API calls  
✅ **Auto-Retry** - Automatic retry with exponential backoff for failed requests  

## Quick Start

### 1. Install Dependencies

```bash
cd plugins/axelar-usman
bun install
```

### 2. Start Development Server

```bash
bun run dev
```

## Access Methods

There are **two ways** to access your plugin with **different endpoint paths**:

### Option A: Direct Plugin Dev Server

Access the plugin directly on port 3015:

- **Dev Server**: http://localhost:3015/
- **API Docs**: http://localhost:3015/api
- **Ping**: `GET http://localhost:3015/api/ping`
- **Snapshot**: `POST http://localhost:3015/api/snapshot`

**Use this for**: Direct testing with curl, Postman, or direct API calls.

**⚠️ Note**: The `/api/rpc` prefix does NOT exist on port 3015. The RPC routing layer is only added by the main server (port 8787). If you try to access `http://localhost:3015/api/rpc/...`, you'll get a 404 Not Found error. Use the direct paths listed above instead.

### Option B: Via Main Server (Integrated)

Access through the main server on port 8787:

**RPC Endpoints** (use camelCase):
- **Ping**: `GET http://localhost:8787/api/rpc/dataProvider/ping`
- **Snapshot**: `POST http://localhost:8787/api/rpc/dataProvider/getSnapshot`

**REST Endpoints** (use kebab-case):
- **Ping**: `GET http://localhost:8787/api/data-provider/ping`
- **Snapshot**: `POST http://localhost:8787/api/data-provider/snapshot`

**Use this for**: Web app integration, when the main server routes to your plugin.

**⚠️ Important**: To use Option B, you must:
1. Update `packages/api/src/plugins.ts` to use `@data-provider/axelar-usman`
2. Set `DATA_PROVIDER_PLUGIN_URL=http://localhost:3015/remoteEntry.js`
3. Start both the main server (`bun run dev` from root) and plugin dev server

### Web App Integration Notes

When integrating with the web app (`apps/web/src/app/page.tsx`), a small modification was needed to correctly link to the API documentation:

```typescript
// Extract base URL without /api/rpc suffix for API docs
const API_DOCS_URL = SERVER_URL.replace('/api/rpc', '/api');
```

**Why this is needed**: The oRPC client connects to `/api/rpc` endpoints (e.g., `http://localhost:8787/api/rpc`), but the Swagger/OpenAPI documentation is served at `/api` (without the `/rpc` suffix). This line strips the `/rpc` part to generate the correct documentation URL for the "API Documentation" link in the web interface.

### 3. Configuration

The plugin uses Axelarscan API (no API key required):

```typescript
// plugin.dev.ts
{
  variables: {
    baseUrl: "https://api.axelarscan.io/api",
    timeout: 30000
  },
  secrets: {
    apiKey: "" // Axelar API is public
  }
}
```

## Running Tests

```bash
# Run all tests (unit + integration)
bun test

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Run tests in watch mode
bun run test:watch
```

### Note on Template Tests

If you run `bun test` from the **parent directory** (repository root), you'll see **4 failing tests** from `plugins/_plugin_template`. This is **expected** and **not a problem** with this plugin:

- ✅ **All 22 axelar-usman tests pass**
- ✗ **4 template tests fail** (intentional - the template has stub implementations)

The template plugin tests are designed to fail to guide developers to implement the actual logic. Your Axelar plugin is fully implemented and all its tests pass successfully.


## Interactive API Testing

An HTML-based test suite is provided for manual testing of the plugin API endpoints in your browser.

### Open Test Interface

```bash
# From the plugin directory
open test-api.html

# Or with full path
open /Users/mac/Desktop/usman/good/data-provider-playground/plugins/axelar-usman/test-api.html
```

The test interface provides:
- 🏥 Health check endpoint test
- 🏓 Ping endpoint test
- 📊 Interactive snapshot testing with multiple scenarios
- 📖 Direct links to API documentation
- ✅ Visual status indicators for each endpoint
- 🎯 Run all tests with one click

**Note**: Make sure the dev server is running (`bun run dev`) before using the test interface.

## API Endpoints

### `POST /api/snapshot`

Get complete snapshot of Axelar bridge data.

**Request Body**:
```json
{
  "routes": [{
    "source": {
      "chainId": "1",
      "assetId": "0xA0b86a33E6442e082877a094f204b01BF645Fe0",
      "symbol": "USDC",
      "decimals": 6
    },
    "destination": {
      "chainId": "137",
      "assetId": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa8417",
      "symbol": "USDC",
      "decimals": 6
    }
  }],
  "notionals": ["1000000", "10000000"],
  "includeWindows": ["24h", "7d", "30d"]
}
```

**Response**:
- **volumes**: Real transfer volumes from Axelarscan 
- **rates**: Transfer quotes with Axelar network fees (~0.1%)
- **liquidity**: Estimated max amounts at 50bps and 100bps slippage
- **listedAssets**: 1910+ assets dynamically loaded from Axelarscan

### `GET /api/ping`

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-08T20:42:57.635Z"
}
```

## Implementation Details

### Data Sources

1. **Axelarscan API** - Official Axelar blockchain explorer
   - `/api/getChains` - Chain configurations
   - `/api/getAssets` - Gateway assets
   - `/token/transfersTotalVolume` - Transfer volumes
   - `/api/getTVL` - Total Value Locked

2. **AxelarJS SDK** - Official Axelar JavaScript SDK
   - `getTransferFee()` - Real network fees
   - Chain name mappings

### Key Features

- **Dynamic Asset Loading**: Fetches all assets from Axelarscan API (no hardcoded lists)
- **Real Volume Data**: Actual transfer volumes from the network
- **Fee Calculation**: Uses AxelarJS SDK for accurate fee quotes
- **Rate Limiting**: Token bucket algorithm (10 requests/second)
- **Auto-Retry**: 3 attempts with exponential backoff
- **Caching**: Chains and assets cached per service instance

## Example Usage

### Direct Plugin Access (Port 3015)

```bash
# Test ping endpoint
curl http://localhost:3015/api/ping

# Test snapshot endpoint
curl -X POST http://localhost:3015/api/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "routes": [{
      "source": {"chainId": "1", "assetId": "0xA0b86a33E6442e082877a094f204b01BF645Fe0", "symbol": "USDC", "decimals": 6},
      "destination": {"chainId": "137", "assetId": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa8417", "symbol": "USDC", "decimals": 6}
    }],
    "notionals": ["1000000"],
    "includeWindows": ["24h", "7d"]
  }'
```

### Via Main Server (Port 8787)

**RPC Endpoints** (camelCase):
```bash
# Test ping endpoint
curl http://localhost:8787/api/rpc/dataProvider/ping

# Test snapshot endpoint
curl -X POST http://localhost:8787/api/rpc/dataProvider/getSnapshot \
  -H "Content-Type: application/json" \
  -d '{
    "routes": [{
      "source": {"chainId": "1", "assetId": "0xA0b86a33E6442e082877a094f204b01BF645Fe0", "symbol": "USDC", "decimals": 6},
      "destination": {"chainId": "137", "assetId": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa8417", "symbol": "USDC", "decimals": 6}
    }],
    "notionals": ["1000000"],
    "includeWindows": ["24h", "7d"]
  }'
```

**REST Endpoints** (kebab-case):
```bash
# Test ping endpoint
curl http://localhost:8787/api/data-provider/ping

# Test snapshot endpoint  
curl -X POST http://localhost:8787/api/data-provider/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "routes": [{
      "source": {"chainId": "1", "assetId": "0xA0b86a33E6442e082877a094f204b01BF645Fe0", "symbol": "USDC", "decimals": 6},
      "destination": {"chainId": "137", "assetId": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa8417", "symbol": "USDC", "decimals": 6}
    }],
    "notionals": ["1000000"],
    "includeWindows": ["24h", "7d"]
  }'
```

## Project Structure

```
plugins/axelar-usman/
├── src/
│   ├── index.ts          # Plugin entry point
│   ├── service.ts        # Axelar service implementation
│   └── contract.ts       # API contract/schema
├── tests/
│   ├── unit/            # Service unit tests
│   └── integration/     # Plugin integration tests
├── plugin.dev.ts        # Dev configuration
├── rspack.config.cjs    # Build configuration
└── package.json         # @data-provider/axelar-usman
```

## Development Commands

```bash
# Start dev server
bun run dev

# Build for production
bun run build

# Type check
bun run type-check

# Run tests
bun test

# Run tests with coverage
bun run coverage
```

## Package Information

- **Name**: `@data-provider/axelar-usman`
- **Version**: 0.0.1
- **Port**: 3015
- **Framework**: every-plugin v0.4.10
