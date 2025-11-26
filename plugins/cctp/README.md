# Data Provider Plugin Template

Template for building bridge data provider plugins for the NEAR Intents data collection system.

## Getting Started

Start the development server:

```bash
bun run dev
```

Your API will be accessible at:

```bash
╭─────────────────────────────────────────────
│  ✅ Plugin dev server ready:
├─────────────────────────────────────────────
│  📡 RPC:    http://localhost:3014/api/rpc
│  📖 Docs:   http://localhost:3014/api
│  💚 Health: http://localhost:3014/
╰─────────────────────────────────────────────
```

The plugin exposes Swagger documentation at the Docs URL.

## Configuration

Edit `plugin.dev.ts` to configure:

- Plugin variables (API URLs, timeouts, etc.)
- Secrets (API keys)
- Test routes and data

## Running Tests

```bash
bun run test
```

## License

Part of the NEAR Intents data collection system.
