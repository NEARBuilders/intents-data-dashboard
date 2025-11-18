import { fromUniswapToken, parse1cs, stringify1cs } from "@defuse-protocol/crosschain-assetid";
import { Effect } from "every-plugin/effect";
import { getChainNamespace } from "./chain-mapping";
import type { AssetDetailsType, AssetInputType } from "./contract";

export class CanonicalAssetService {

  /**
   * Convert standard asset data to 1cs_v1 canonical format
   */
  toCanonical(input: AssetInputType): Effect.Effect<{ canonical: string }, Error> {
    return Effect.try({
      try: () => {
        // For EVM tokens with chainId, use fromUniswapToken helper
        if (input.chainId !== undefined && input.address) {
          const canonical = fromUniswapToken({
            chainId: input.chainId,
            address: input.address
          });
          return { canonical };
        }

        // For all other cases (native EVM, non-EVM), use manual construction
        const chainSlug = input.chain.toLowerCase();

        const chainMapping = getChainNamespace(chainSlug, input.address);

        const canonical = stringify1cs({
          version: 'v1',
          chain: chainSlug,
          ...chainMapping
        });

        return { canonical };
      },
      catch: (error) => {
        throw new Error(`Failed to create canonical ID: ${error}`);
      }
    });

  }

  /**
   * Get chainId from slug using CAIP-2 registry reverse lookup
   */
  private getChainIdFromSlug(slug: string): number | undefined {
    // Reverse lookup from CAIP-2 registry
    const slugMappings: Record<string, number> = {
      'eth': 1,
      'optimism': 10,
      'bsc': 56,
      'gnosis': 100,
      'polygon': 137,
      'base': 8453,
      'arbitrum': 42161,
      'avalanche': 43114,
      'berachain': 80085,
      // Non-EVM (these don't have chainIds in same way)
      // 'bitcoin', 'zcash', 'doge', 'near', 'sol', 'tron' etc.
    };

    return slugMappings[slug];
  }

  /**
   * Parse 1cs_v1 canonical format to detailed asset information
   */
  fromCanonical(canonical: string): Effect.Effect<AssetDetailsType, Error> {
    const self = this;
    return Effect.try({
      try: () => {
        // Parse canonical ID using official library
        const parsed = parse1cs(canonical);

        // Validate parsed structure
        if (!parsed.version || !parsed.chain || !parsed.namespace || !parsed.reference) {
          throw new Error('Invalid 1cs_v1 format: missing required components');
        }

        // Fuzzy search for chainId
        const chainId = self.getChainIdFromSlug(parsed.chain);

        // Create details
        const details: AssetDetailsType = {
          version: 'v1',
          chain: parsed.chain,
          namespace: parsed.namespace,
          reference: parsed.reference,
          selector: parsed.selector,
          ...(chainId !== undefined ? { chainId } : {})
        };

        return details;
      },
      catch: (error: unknown) => {
        if (error instanceof Error && error.message.includes('Invalid 1cs_v1')) {
          throw error;
        }
        throw new Error(`Failed to parse canonical ID: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }
}
