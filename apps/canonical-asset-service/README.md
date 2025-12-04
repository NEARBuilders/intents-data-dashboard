# Canonical Asset Service

Service for managing and synchronizing canonical asset data across bridge providers, using [1cs_v1 — Unified Cross-Chain Asset Identifier](https://github.com/defuse-protocol/sdk-monorepo/tree/main/packages/crosschain-assetid) for canonical reference.

## Architecture

- **Framework**: Hono server running on Bun
- **API**: Exposes both RPC (`/api/rpc`) and REST/OpenAPI (`/api`) endpoints using `@orpc`
- **Sync**: Runs configurable Cron job (`SYNC_CRON_SCHEDULE`) to orchestrate data synchronization from the aggregator
- **Data**: Connects to Turso/LibSQL database and uses an asset enrichment plugin for data normalization

## Development

```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
