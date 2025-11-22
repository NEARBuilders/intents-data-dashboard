export interface CoinGeckoPlatform {
  id: string;
  chain_identifier: number | null;
  name: string;
  shortname: string;
  native_coin_id: string;
  image?: {
    thumb: string;
    small: string;
    large: string;
  };
}

export interface CoinGeckoTokenListToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
}

export interface CoinGeckoTokenListResponse {
  name: string;
  logoURI: string;
  keywords: string[];
  timestamp: string;
  tokens: CoinGeckoTokenListToken[];
}
