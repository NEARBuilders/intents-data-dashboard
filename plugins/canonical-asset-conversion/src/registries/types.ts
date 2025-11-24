import type { AssetType } from "@data-provider/shared-contract";

export interface AssetMetadata {
  symbol?: string;
  decimals?: number;
  iconUrl?: string;
  name?: string;
}

export interface RegistryClient {
  /**
   * Find asset metadata by blockchain and contract reference
   */
  findByReference(
    blockchain: string,
    reference: string
  ): Promise<AssetMetadata | null>;

  /**
   * Find asset metadata by symbol and blockchain
   */
  findBySymbol(
    symbol: string,
    blockchain: string
  ): Promise<AssetMetadata | null>;

  /**
   * Get native coin metadata for a blockchain
   */
  getNativeCoin(blockchain: string): Promise<AssetMetadata | null>;
}
