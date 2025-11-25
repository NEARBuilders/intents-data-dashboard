import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { Asset } from "@data-provider/shared-contract";

const CommonChains = z.enum([
  'eth', 'arb', 'pol', 'bsc', 'op', 'matic', 'bnb',
  'base', 'sol', 'near', 'ton', 'aptos', 'sui', 'btc'
]);

const CommonNamespaces = z.enum([
  'erc20', 'erc721', 'erc1155', 'spl', 'nep141', 'nep171', 'near-nft',
  'native', 'aptos-coin', 'iso4217', 'stellar-asset'
]);

const BlockchainSchema = z.union([CommonChains, z.string()]);

const NamespaceSchema = z.union([CommonNamespaces, z.string()]);

// Input for normalization from arbitrary descriptor
export const AssetDescriptor = z.object({
  blockchain: BlockchainSchema.describe('canonical blockchain slug (e.g., "eth", "arb", "sol", "near")'),
  chainId: z.number().optional().describe('optional EVM chain ID'),
  namespace: NamespaceSchema.optional().describe('e.g., "erc20", "native", "nep141"'),
  reference: z.string().optional().describe('contract address or "coin" for native'),
  symbol: z.string().optional().describe('display symbol (e.g., "USDC", "ETH")'),
  decimals: z.number().optional().describe('token decimals'),
});

export const CanonicalIdInput = z.object({
  assetId: z.string()
    .refine(
      (id) => id.startsWith('1cs_v1:'),
      { message: 'Must start with 1cs_v1' }
    )
    .describe('canonical 1cs_v1 asset ID'),
});

// Input for building canonical ID
export const CanonicalIdComponents = z.object({
  blockchain: z.string().describe('canonical blockchain slug'),
  namespace: z.string().describe('asset standard/kind'),
  reference: z.string().describe('contract address or "coin"'),
});

export const Network = z.object({
  blockchain: z.string().describe('canonical blockchain slug'),
  displayName: z.string().describe('human-readable network name'),
  symbol: z.string().describe('native currency symbol'),
  iconUrl: z.string().optional().describe('network icon URL'),
});

export const contract = oc.router({
  // Enrich arbitrary asset descriptor into canonical Asset
  enrich: oc
    .route({
      method: 'POST',
      path: '/enrich',
      summary: 'Enrich Asset',
      description: `Takes a partial asset description and enriches it with registry metadata (symbol, decimals, iconUrl). Always returns an asset, falling back to best-effort data if registries don't have full information.
      
**Examples:**
- Ethereum USDC: \`{ "blockchain": "eth", "chainId": 1, "reference": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "symbol": "USDC", "decimals": 6 }\`
- Solana SOL: \`{ "blockchain": "sol", "symbol": "SOL", "decimals": 9 }\`
- Arbitrum native: \`{ "blockchain": "arb", "chainId": 42161, "namespace": "native", "reference": "coin", "symbol": "ETH", "decimals": 18 }\``,
    })
    .input(AssetDescriptor)
    .output(Asset),

  // Convert 1cs_v1 assetId into canonical Asset
  fromCanonicalId: oc
    .route({
      method: 'POST',
      path: '/fromCanonical',
      summary: 'Convert 1cs_v1 assetId to Asset',
      description: `Parses the canonical assetId, enriches with chain/namespace/reference and registry metadata (symbol, decimals, iconUrl).
      
**Example:**
- Input: \`{ "assetId": "1cs_v1:eth:erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }\`
- Output: Full Asset object with symbol, decimals, iconUrl from registries`,
    })
    .input(CanonicalIdInput)
    .output(Asset),

  // Build 1cs_v1 assetId from canonical components
  toCanonicalId: oc
    .route({
      method: 'POST',
      path: '/toCanonical',
      summary: 'Convert Asset to 1cs_v1 assetId',
      description: `Constructs a canonical 1cs_v1 assetId from its components.
      
**Example:**
- Input: \`{ "blockchain": "eth", "namespace": "erc20", "reference": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }\`
- Output: \`{ "assetId": "1cs_v1:eth:erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }\``,
    })
    .input(CanonicalIdComponents)
    .output(z.object({ assetId: z.string() })),

  getBlockchains: oc
    .route({
      method: 'GET',
      path: '/blockchains',
      summary: 'List blockchains',
      description: 'Returns all blockchains (EVM and non-EVM) with display name, symbol, and iconUrl based on underlying registries',
    })
    .output(z.array(Network)),

  getStoredAssets: oc
    .route({
      method: 'GET',
      path: '/stored-assets',
      summary: 'List all assets',
      description: 'Returns all canonical assets currently cached in the local SQLite database',
    })
    .output(z.array(Asset)),

  ping: oc
    .route({
      method: 'GET',
      path: '/ping',
      summary: 'Health check endpoint',
      description: 'Returns service health status and uptime information',
    })
    .output(
      z.object({
        status: z.literal('ok'),
        timestamp: z.string(),
      }),
    ),

  sync: oc
    .route({
      method: 'POST',
      path: '/sync',
      summary: 'Sync registry data',
      description: 'Manually trigger synchronization of token data from Uniswap, CoinGecko, and Jupiter registries. Runs asynchronously in the background.',
    })
    .output(
      z.object({
        status: z.string(),
      }),
    ),

  getPrice: oc
    .route({
      method: 'POST',
      path: '/price',
      summary: 'Get asset price',
      description: 'Fetch the current USD price for an asset using its canonical ID. Prices are cached for 3 minutes.',
    })
    .input(CanonicalIdInput)
    .output(
      z.object({
        price: z.number().nullable().describe('Current price in USD, null if unavailable'),
        timestamp: z.number().nullable().describe('Unix timestamp when price was last updated'),
      }),
    )
});

// Export inferred types
export type AssetDescriptorType = z.infer<typeof AssetDescriptor>;
export type CanonicalIdInputType = z.infer<typeof CanonicalIdInput>;
export type CanonicalIdComponentsType = z.infer<typeof CanonicalIdComponents>;
