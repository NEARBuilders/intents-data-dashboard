export interface Asset {
  blockchain: string;
  assetId: string;
  symbol: string;
  decimals?: number;
  contractAddress?: string;
  iconUrl?: string;
}

export interface Route {
  source: Asset;
  destination: Asset;
}

export interface ProviderInfo {
  id: string;
  label: string;
  supportedData: string[];
}
