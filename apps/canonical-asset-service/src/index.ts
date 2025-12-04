import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { BatchHandlerPlugin } from '@orpc/server/plugins'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { CronJob } from 'cron'
import { Effect } from 'every-plugin/effect'

import { createContext } from './context'
import { initializePlugins } from './plugins'
import { createRouter } from './routers'
import { serverEnv } from './env'
import { runOrchestratedSync } from './sync-job'

const plugins = await initializePlugins({
  secrets: {
    DATABASE_URL: serverEnv.DATABASE_URL,
    DATABASE_AUTH_TOKEN: serverEnv.DATABASE_AUTH_TOKEN,
  },
  remote: serverEnv.ASSET_ENRICHMENT_REMOTE_ENTRY_URL
});

const router = createRouter(plugins);

const app = new Hono()

app.use('/*', cors({
  origin: serverEnv.CORS_ORIGIN?.split(',').map(origin => origin.trim())
    ?? ['http://localhost:3001'],
  credentials: true,
}))

// Create RPC handler
const rpcHandler = new RPCHandler(router, {
  plugins: [new BatchHandlerPlugin()],
  interceptors: [
    onError((error) => {
      console.error('RPC Error:', error)
    }),
  ]
})

// Create OpenAPI handler
const apiHandler = new OpenAPIHandler(router, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: 'everything assets',
          version: '1.0.0',
        },
        servers: [ // or let the plugin auto-infer from the request
          { url: 'https://assets.everything.dev/api', },
          { url: 'http://localhost:6767/api' },
        ],
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error('OpenAPI Error:', error)
    }),
  ],
})

// Health check
app.get('/', (c) => {
  return c.text('OK')
})

// RPC endpoint
app.all('/api/rpc/*', async (c) => {
  if (!rpcHandler) return c.text('Loading...', 503)

  const req = c.req.raw
  const context = await createContext(req)

  const result = await rpcHandler.handle(req, {
    prefix: '/api/rpc',
    context
  })

  return result.response
    ? c.newResponse(result.response.body, result.response)
    : c.text('Not Found', 404)
})

// REST/OpenAPI endpoint (w/ OpenAPI Documentation UI)
app.all('/api/*', async (c) => {
  if (!apiHandler) return c.text('Loading...', 503)

  const req = c.req.raw
  const context = await createContext(req)

  const result = await apiHandler.handle(req, {
    prefix: '/api',
    context
  });

  return result.response
    ? c.newResponse(result.response.body, result.response)
    : c.text('Not Found', 404)
})

// 404 handler

app.all('*', (c) => c.text('Not Found', 404))

if (serverEnv.SYNC_CRON_SCHEDULE) {
  console.log(`[Cron] Setting up orchestrated sync job with schedule: ${serverEnv.SYNC_CRON_SCHEDULE}`);
  
  const syncJob = new CronJob(
    serverEnv.SYNC_CRON_SCHEDULE,
    () => {
      console.log('[Cron] Triggering orchestrated sync...');
      
      Effect.runPromise(
        runOrchestratedSync(plugins, {
          aggregatorUrl: serverEnv.AGGREGATOR_URL,
        })
      ).catch((error) => {
        console.error('[Cron] Orchestrated sync failed:', error);
      });
    },
    null,
    true,
    'UTC'
  );

  console.log('[Cron] Orchestrated sync job started');
} else {
  console.log('[Cron] No SYNC_CRON_SCHEDULE configured, orchestrated sync will not run automatically');
  console.log('[Cron] To enable, set SYNC_CRON_SCHEDULE env var (e.g., "0 0 * * 0" for weekly on Sunday midnight UTC)');
}

console.log(`
  Assets service running on port ${serverEnv.PORT}

  Available endpoints:
   http://localhost:${serverEnv.PORT}/        → Health check
   http://localhost:${serverEnv.PORT}/api     → REST API (OpenAPI docs at /api/spec.ui)
   http://localhost:${serverEnv.PORT}/api/rpc → RPC endpoint
`)

export default {
  port: serverEnv.PORT,
  fetch: app.fetch,
};
