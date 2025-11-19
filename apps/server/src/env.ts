import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const serverEnv = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('8787').transform(Number),
    CORS_ORIGIN: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
})
