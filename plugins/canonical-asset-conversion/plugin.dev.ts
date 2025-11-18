import type { PluginConfigInput } from 'every-plugin';
import type Plugin from './src/index';
import packageJson from './package.json' with { type: 'json' };


export default {
  pluginId: packageJson.name, // DO NOT CHANGE
  port: 3014,
  config: {
    // Update these variables to what's required for your plugin
    variables: {
    },
    secrets: {
    }
  } satisfies PluginConfigInput<typeof Plugin>
}
