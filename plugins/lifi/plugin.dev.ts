import type { PluginConfigInput } from 'every-plugin';
import type Plugin from './src/index';
import packageJson from './package.json' with { type: 'json' };

// Universal cross-chain route for testing: Ethereum USDC → Arbitrum USDC
// This route is used across all plugins for consistent testing
export const testRoutes = [
  {
    source: {
      assetId: "1cs_v1:eth:erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      blockchain: "eth",
      chainId: 1,
      namespace: "erc20",
      reference: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    destination: {
      assetId: "1cs_v1:arbitrum:erc20:0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      blockchain: "arbitrum",
      chainId: 42161,
      namespace: "erc20",
      reference: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    }
  }
];

export default {
  pluginId: packageJson.name, // DO NOT CHANGE
  port: 3014,
  config: {
    // Update these variables to what's required for your plugin
    variables: {
      baseUrl: "https://api.example.com",
      timeout: 1000
    },
    secrets: {
      apiKey: process.env.PLUGIN_API_KEY || "dev-key-12345"
    }
  } satisfies PluginConfigInput<typeof Plugin>
}
