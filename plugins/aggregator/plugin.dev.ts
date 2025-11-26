import 'dotenv/config';
import type { PluginConfigInput } from 'every-plugin';
import packageJson from './package.json' with { type: 'json' };
import type Plugin from './src/index';

export default {
  pluginId: packageJson.name, // DO NOT CHANGE
  port: 3014,
  config: {
    variables: {
      isDevelopment: true,
    },
    secrets: {
      DUNE_API_KEY: process.env.DUNE_API_KEY!,
      NEAR_INTENTS_API_KEY: process.env.NEAR_INTENTS_API_KEY!,
      REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
      COINGECKO_DEMO_API_KEY: process.env.COINGECKO_DEMO_API_KEY!
    }
  } satisfies PluginConfigInput<typeof Plugin>
}
