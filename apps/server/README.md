# Server

Main backend service aggregating data from multiple bridge providers.

## Architecture

- **Framework**: Hono server running on Bun
- **API**: Exposes both RPC (`/api/rpc`) and REST/OpenAPI (`/api`) endpoints using `@orpc`
- **Plugins**: Initializes and orchestrates data provider plugins via `@data-provider/api`

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
