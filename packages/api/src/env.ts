import { createEnv } from '@t3-oss/env-core'
import { z } from 'every-plugin/zod'

export const apiEnv = createEnv({
  server: {
    DUNE_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    DUNE_API_KEY: process.env.DUNE_API_KEY,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
})
