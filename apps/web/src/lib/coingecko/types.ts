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

export interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export interface EnrichedAsset extends CoinGeckoMarketCoin {
  platforms: Record<string, string>;
}

export interface CoinGeckoListCoin {
  id: string;
  symbol: string;
  name: string;
  platforms: Record<string, string>;
}
