import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const serverEnv = createEnv({
  server: {
    PORT: z.string().default('6767').transform(Number),
    CORS_ORIGIN: z.string().optional(),

    DATABASE_URL: z.string(),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    ASSET_ENRICHMENT_REMOTE_ENTRY_URL: z.string(),
    
    AGGREGATOR_URL: z.string().default('http://localhost:8787/api/rpc'),
    SYNC_CRON_SCHEDULE: z.string().optional(),
  },
  runtimeEnv: {
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,

    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
    ASSET_ENRICHMENT_REMOTE_ENTRY_URL: process.env.ASSET_ENRICHMENT_REMOTE_ENTRY_URL,
    
    AGGREGATOR_URL: process.env.AGGREGATOR_URL,
    SYNC_CRON_SCHEDULE: process.env.SYNC_CRON_SCHEDULE,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
})
