import 'dotenv/config';
import type { PluginConfigInput } from 'every-plugin';
import type Plugin from './src/index';
import packageJson from './package.json' with { type: 'json' };

export default {
  pluginId: packageJson.name, // DO NOT CHANGE
  port: 3010,
  config: {
    // Update these variables to what's required for your plugin
    variables: {
    },
    secrets: {
      DATABASE_URL: process.env.DATABASE_URL!,
      DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN!
    }
  } satisfies PluginConfigInput<typeof Plugin>
}
