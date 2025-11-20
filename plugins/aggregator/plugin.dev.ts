import type { PluginConfigInput } from 'every-plugin';
import type Plugin from './src/index';
import packageJson from './package.json' with { type: 'json' };
import 'dotenv/config'

export default {
  pluginId: packageJson.name, // DO NOT CHANGE
  port: 3014,
  config: {
    // Update these variables to what's required for your plugin
    variables: {
    },
    secrets: {
      DUNE_API_KEY: process.env.DUNE_API_KEY!,
      NEAR_INTENTS_API_KEY: process.env.NEAR_INTENTS_API_KEY!
    }
  } satisfies PluginConfigInput<typeof Plugin>
}
