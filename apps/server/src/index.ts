import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import 'dotenv/config'

import { initializePlugins, createRouter, createContext } from '@data-provider/api'

const plugins = await initializePlugins({
  secrets: { DUNE_API_KEY: process.env.DUNE_API_KEY! },
  isDevelopment: process.env.NODE_ENV !== 'production'
});

const router = createRouter(plugins);

const app = new Hono()

app.use('/*', cors({
  origin: process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim())
    ?? ['http://localhost:3001'],
  credentials: true,
}))

// Create RPC handler
const rpcHandler = new RPCHandler(router, {
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
          title: 'everything intents',
          version: '1.0.0',
        },
        servers: [ // or let the plugin auto-infer from the request
          { url: 'https://intents.everything.dev/api', },
          { url: 'http://localhost:8787/api' },
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

const port = Number(process.env.PORT) || 8787

export default {
  port: port,
  fetch: app.fetch,
};
