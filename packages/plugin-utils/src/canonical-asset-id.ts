import {
  parse1cs,
  stringify1cs,
  fromUniswapToken,
} from "@defuse-protocol/crosschain-assetid";
import type { AssetType } from "@data-provider/shared-contract";
import { getBlockchainFromChainId, getChainNamespace } from "./blockchain-mapping";

export interface CanonicalIdentity {
  assetId: string;
  blockchain: string;
  namespace: string;
  reference: string;
}

type AssetLike =
  | (Partial<AssetType> & { assetId?: string })
  | { chainId: number | string; address: string };

/**
 * Central function to normalize any asset-like input into canonical identity.
 *
 * Handles three input shapes:
 * 1. AssetType with assetId → parse and extract components
 * 2. AssetType with blockchain/namespace/reference → build assetId
 * 3. Provider asset with chainId/address → derive blockchain, build assetId
 *
 * Uses fromUniswapToken as fast path for EVM chains, falls back to chain mapping.
 */
export async function assetToCanonicalIdentity(
  input: AssetLike,
): Promise<CanonicalIdentity> {
  // Case 1: chainId + address
  if ("chainId" in input && "address" in input) {
    const numericChainId =
      typeof input.chainId === "string"
        ? parseInt(input.chainId, 10)
        : input.chainId;

    // Fast path: fromUniswapToken (handles most EVM chains)
    try {
      const assetId = fromUniswapToken({
        chainId: numericChainId,
        address: input.address.toLowerCase(),
      });

      const parsed = parse1cs(assetId);
      
      return {
        assetId,
        blockchain: parsed.chain,
        namespace: parsed.namespace,
        reference: parsed.reference,
      };
    } catch {
      // Fallback: use custom chain mapping
      const blockchain = getBlockchainFromChainId(
        String(numericChainId),
      );
      if (!blockchain) {
        throw new Error(
          `assetToCanonicalIdentity: unknown chainId ${input.chainId}`,
        );
      }

      const { namespace, reference } = getChainNamespace(
        blockchain,
        input.address.toLowerCase(),
      );

      const assetId = stringify1cs({
        version: "v1",
        chain: blockchain,
        namespace,
        reference,
      });

      return { assetId, blockchain, namespace, reference };
    }
  }

  // Case 2: AssetType-ish (canonical format)
  const asset = input as Partial<AssetType> & { assetId?: string };

  let blockchain = asset.blockchain;
  let namespace = asset.namespace;
  let reference = asset.reference;

  if (asset.assetId) {
    const parsed = parse1cs(asset.assetId);
    blockchain = blockchain ?? parsed.chain;
    namespace = namespace ?? parsed.namespace;
    reference = reference ?? parsed.reference;
  }

  if (!blockchain || !namespace || !reference) {
    throw new Error(
      "assetToCanonicalIdentity: need either assetId, or " +
        "blockchain+namespace+reference, or chainId+address",
    );
  }

  const assetId =
    asset.assetId ??
    stringify1cs({
      version: "v1",
      chain: blockchain,
      namespace,
      reference,
    });

  return { assetId, blockchain, namespace, reference };
}

/**
 * Build a complete AssetType from canonical identity + metadata.
 * This is the inverse of assetToCanonicalIdentity - it adds symbol/decimals/iconUrl.
 */
export function canonicalToAsset(
  identity: Omit<CanonicalIdentity, "assetId"> & { assetId?: string },
  meta: Pick<AssetType, "symbol" | "decimals"> &
    Partial<Pick<AssetType, "chainId" | "iconUrl">>,
): AssetType {
  const assetId =
    identity.assetId ??
    stringify1cs({
      version: "v1",
      chain: identity.blockchain,
      namespace: identity.namespace,
      reference: identity.reference,
    });

  return {
    assetId,
    blockchain: identity.blockchain,
    namespace: identity.namespace,
    reference: identity.reference,
    chainId: meta.chainId,
    symbol: meta.symbol,
    decimals: meta.decimals,
    iconUrl: meta.iconUrl,
  };
}
