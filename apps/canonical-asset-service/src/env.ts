import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const serverEnv = createEnv({
  server: {
    PORT: z.string().default('6767').transform(Number),
    CORS_ORIGIN: z.string().optional(),

    DATABASE_URL: z.string(),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    ASSET_ENRICHMENT_REMOTE_ENTRY_URL: z.string()
  },
  runtimeEnv: {
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,

    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
    ASSET_ENRICHMENT_REMOTE_ENTRY_URL: process.env.ASSET_ENRICHMENT_REMOTE_ENTRY_URL
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
})
