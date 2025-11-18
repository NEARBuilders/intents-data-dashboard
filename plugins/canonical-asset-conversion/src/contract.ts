import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

// Common chains for autocomplete
const CommonChains = z.enum([
  'eth', 'arb', 'pol', 'bsc', 'op', 'matic', 'bnb',
  'base', 'sol', 'near', 'ton', 'aptos', 'sui', 'fiat'
]);

// Common namespaces for autocomplete
const CommonNamespaces = z.enum([
  'erc20', 'erc721', 'erc1155', 'spl', 'nep141', 'nep171', 'near-nft',
  'native', 'aptos-coin', 'iso4217', 'stellar-asset'
]);

// Flexible chains: Common ones + Extensible custom
export const SupportedChains = z.union([
  CommonChains,
  z.string()  // Allow any chain slug for extensibility
]);

// Flexible namespaces: Common ones + Extensible custom
export const SupportedNamespaces = z.union([
  CommonNamespaces,
  z.string()  // Allow any namespace for extensibility
]);

// Input schemas
export const AssetInput = z.object({
  chainId: z.number().optional()
    .describe('Optional EVM chain ID (e.g., 1 for Ethereum, 42161 for Arbitrum). Used with address for EVM token lookups.'),
  chain: z.string()
    .describe('Chain slug (e.g., "eth", "sol", "near", "ton"). Required. Use lowercase canonical slugs.'),
  address: z.string().optional()
    .describe('Token contract/mint address. Omit for native coins. Examples: "0xA0b..." (EVM), "EPjF..." (Solana).'),
  symbol: z.string()
    .describe('Asset symbol for display (e.g., "USDC", "ETH", "SOL")'),
  decimals: z.number().optional()
    .describe('Token decimals (e.g., 6 for USDC, 18 for ETH). Optional metadata.')
});

// Output schemas - matches 1cs_v1 OneCsAsset interface
export const AssetDetails = z.object({
  version: z.literal('v1')
    .describe('1cs format version'),
  chain: SupportedChains
    .describe('Lowercase chain slug (e.g., "eth", "sol", "near"). Can encode testnet in slug (e.g., "eth-sepolia").'),
  namespace: SupportedNamespaces
    .describe('Asset standard/kind. Examples: "erc20" (EVM tokens), "spl" (Solana), "nep141" (NEAR tokens), "native" (native coins), "erc721" (NFTs).'),
  reference: z.string()
    .describe('URI-encoded contract/mint/account address. Examples: "0xa0b..." (EVM), "EPjF..." (Solana), "coin" (native).'),
  selector: z.string().optional()
    .describe('Optional sub-asset selector for NFTs, token IDs, etc. URI-encoded. Example: "42" (ERC-721 token ID), "series:1/blue:42" (NEAR NFT).'),
  chainId: z.number().optional()
    .describe('EVM chain ID if applicable (e.g., 1 for Ethereum). Only present for EVM chains.')
});

// oRPC contract with OpenAPI metadata
export const contract = oc.router({
  // FROM standard format → convert TO canonical
  from: oc
    .route({
      method: 'POST',
      path: '/from',
      summary: 'Convert FROM standard format to 1cs_v1 canonical',
      description: `Takes standard asset data and converts to canonical format.

**Examples:**
- Ethereum USDC: \`{ "chainId": 1, "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "symbol": "USDC" }\`
- Solana USDC: \`{ "chain": "sol", "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "symbol": "USDC" }\`
- Ethereum native: \`{ "chainId": 1, "symbol": "ETH" }\``,
      successDescription: 'Returns canonical 1cs_v1 asset identifier'
    })
    .input(AssetInput)
    .output(z.object({ canonical: z.string() })),

  // TO standard format ← convert FROM canonical
  to: oc
    .route({
      method: 'POST',
      path: '/to',
      summary: 'Convert TO standard format from 1cs_v1 canonical',
      description: `Parses canonical format and returns structured asset details.

**Example:**
- Input: \`"1cs_v1:eth:erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"\`
- Output: \`{ "version": "v1", "chain": "eth", "namespace": "erc20", "reference": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }\``,
      successDescription: 'Returns parsed asset details with metadata'
    })
    .input(z.object({ canonical: z.string() }))
    .output(AssetDetails),

  ping: oc
    .route({
      method: 'GET',
      path: '/ping',
      summary: 'Health check endpoint',
      description: 'Returns service health status and uptime information',
    })
    .output(z.object({
      status: z.literal('ok'),
      timestamp: z.string(),
    }))
});

// Export inferred types for use in service layer
export type AssetInputType = z.infer<typeof AssetInput>;
export type AssetDetailsType = z.infer<typeof AssetDetails>;
