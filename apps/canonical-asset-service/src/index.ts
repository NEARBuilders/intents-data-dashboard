import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { router } from './routers'
import { createContext } from './context'

const app = new Hono()

// CORS middleware
app.use('/*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
}));

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'canonical-asset-service',
    version: '1.0.0'
  });
});

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
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error('OpenAPI Error:', error)
    }),
  ]
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

// REST/OpenAPI endpoint
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
});

// 404 handler
app.all('*', (c) => c.json({ error: 'Not Found' }, 404));

const port = Number(process.env.PORT) || 8787;

export default {
  port,
  fetch: app.fetch,
};
