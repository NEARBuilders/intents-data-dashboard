## Demo runner — Li.Fi adapter

This package includes two demo runners to inspect a generated provider snapshot locally:

- `dev/demo.mjs` — JavaScript Node ESM script. Defaults to mock mode and produces a deterministic snapshot without external network calls. Use this for fast local inspection.
- `dev/demo.ts` — TypeScript demo that runs the adapter against the real provider (live network calls). This requires `tsx` to run locally.

## Installation

Before running demos, install dependencies:

```bash
# From repository root
npm install

# Install tsx for TypeScript demo (if not already installed)
cd packages/lifi-adapter
npm install tsx --save-dev
```

## Running the demos

From `packages/lifi-adapter` directory:

```bash
# Start the HTTP demo server (serves GET /snapshot)
npm run demo

# Run the mock demo (fast, deterministic)
npm run demo:mock

# Run the live TypeScript demo (uses local tsx binary installed as a devDependency)
npm run demo:live
```

Notes on `demo:live`:
- We added `tsx` as a devDependency so `npm run demo:live` uses the local binary; you don't need `npx` or a global `tsx` install.

Environment variables

- `MOCK_MODE` — override demo mode (true/false). `dev/demo.mjs` defaults to mock=true; `dev/demo.ts` defaults to mock=false.
- `NOTIONAL` — quoting/probing amount (default: `1000000` — smallest token units).
- `LIFI_BASE_URL` — Li.Fi base URL (default: `https://li.quest/v1`).
- `LIFI_TIMEOUT` — HTTP timeout in ms (default: `10000`).
- `DEMO_PORT` — port used by `dev/server.mjs` (default: `3001`).
