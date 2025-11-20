// CoinMarketCap API integration
// Documentation: https://coinmarketcap.com/api/documentation/v1/

// Use proxy in development to avoid CORS issues
const API_BASE_URL = import.meta.env.DEV 
  ? '/api/coinmarketcap' 
  : 'https://pro-api.coinmarketcap.com/v1';

export interface Cryptocurrency {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank: number;
  logo?: string;
  quote: {
    USD: {
      price: number;
      volume_24h: number;
      percent_change_24h: number;
      percent_change_7d: number;
      market_cap: number;
    };
  };
}

export interface CoinMarketCapResponse {
  data: { [key: string]: Cryptocurrency };
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
  };
}

/**
 * Get cryptocurrency data from CoinMarketCap API
 * @param symbols - Array of cryptocurrency symbols (e.g., ['BTC', 'ETH', 'USDT'])
 * @returns Promise with cryptocurrency data
 */
export async function getCryptocurrencyData(
  symbols: string[]
): Promise<Cryptocurrency[]> {
  const apiKey = import.meta.env.VITE_COINMARKETCAP_API_KEY;

  if (!apiKey || apiKey === 'your-api-key-here') {
    console.warn('⚠️ CoinMarketCap API key not found. Using mock data.');
    return getMockCryptocurrencyData(symbols);
  }

  try {
    const symbolString = symbols.join(',');
    const url = `${API_BASE_URL}/cryptocurrency/quotes/latest?symbol=${symbolString}`;

    // In development, use proxy (API key handled by proxy)
    // In production, send API key in headers
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (!import.meta.env.DEV) {
      headers['X-CMC_PRO_API_KEY'] = apiKey;
    }

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Response Error:', response.status, errorText);
      throw new Error(`CoinMarketCap API error: ${response.statusText}`);
    }

    const data: CoinMarketCapResponse = await response.json();

    if (data.status.error_code !== 0) {
      console.error('❌ API Error Code:', data.status.error_code);
      console.error('❌ API Error Message:', data.status.error_message);
      throw new Error(data.status.error_message || 'Unknown API error');
    }

    // Convert object to array and sort by rank
    const result = Object.values(data.data).sort((a, b) => a.cmc_rank - b.cmc_rank);
    
    // Add logo URLs from CoinMarketCap CDN
    const resultWithLogos = result.map((crypto) => ({
      ...crypto,
      logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${crypto.id}.png`,
    }));
    
    return resultWithLogos;
  } catch (error) {
    console.error('❌ Error fetching CoinMarketCap data:', error);
    console.warn('⚠️ Falling back to mock data');
    // Fallback to mock data on error
    return getMockCryptocurrencyData(symbols);
  }
}

/**
 * Get mock cryptocurrency data for development/fallback
 */
function getMockCryptocurrencyData(symbols: string[]): Cryptocurrency[] {
  const mockData: { [key: string]: Partial<Cryptocurrency> } = {
    BTC: {
      id: 1,
      name: 'Bitcoin',
      symbol: 'BTC',
      slug: 'bitcoin',
      cmc_rank: 1,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
      quote: {
        USD: {
          price: 43250.50,
          volume_24h: 25000000000,
          percent_change_24h: 2.5,
          percent_change_7d: 5.2,
          market_cap: 850000000000,
        },
      },
    },
    ETH: {
      id: 1027,
      name: 'Ethereum',
      symbol: 'ETH',
      slug: 'ethereum',
      cmc_rank: 2,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
      quote: {
        USD: {
          price: 2650.75,
          volume_24h: 12000000000,
          percent_change_24h: 1.8,
          percent_change_7d: 3.5,
          market_cap: 320000000000,
        },
      },
    },
    USDT: {
      id: 825,
      name: 'Tether',
      symbol: 'USDT',
      slug: 'tether',
      cmc_rank: 3,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
      quote: {
        USD: {
          price: 1.00,
          volume_24h: 50000000000,
          percent_change_24h: 0.01,
          percent_change_7d: 0.02,
          market_cap: 95000000000,
        },
      },
    },
    XRP: {
      id: 52,
      name: 'XRP',
      symbol: 'XRP',
      slug: 'xrp',
      cmc_rank: 5,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png',
      quote: {
        USD: {
          price: 0.62,
          volume_24h: 2000000000,
          percent_change_24h: -1.2,
          percent_change_7d: 2.1,
          market_cap: 34000000000,
        },
      },
    },
    BNB: {
      id: 1839,
      name: 'BNB',
      symbol: 'BNB',
      slug: 'binancecoin',
      cmc_rank: 4,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png',
      quote: {
        USD: {
          price: 315.20,
          volume_24h: 1500000000,
          percent_change_24h: 0.5,
          percent_change_7d: 1.8,
          market_cap: 48000000000,
        },
      },
    },
    SOL: {
      id: 5426,
      name: 'Solana',
      symbol: 'SOL',
      slug: 'solana',
      cmc_rank: 6,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png',
      quote: {
        USD: {
          price: 98.50,
          volume_24h: 3000000000,
          percent_change_24h: 3.2,
          percent_change_7d: 8.5,
          market_cap: 45000000000,
        },
      },
    },
    USDC: {
      id: 3408,
      name: 'USD Coin',
      symbol: 'USDC',
      slug: 'usd-coin',
      cmc_rank: 7,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
      quote: {
        USD: {
          price: 1.00,
          volume_24h: 4000000000,
          percent_change_24h: 0.00,
          percent_change_7d: 0.01,
          market_cap: 28000000000,
        },
      },
    },
    ZEC: {
      id: 1437,
      name: 'Zcash',
      symbol: 'ZEC',
      slug: 'zcash',
      cmc_rank: 150,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1437.png',
      quote: {
        USD: {
          price: 28.50,
          volume_24h: 50000000,
          percent_change_24h: -0.8,
          percent_change_7d: -2.1,
          market_cap: 450000000,
        },
      },
    },
  };

  return symbols
    .map((symbol) => mockData[symbol.toUpperCase()])
    .filter((data): data is Cryptocurrency => data !== undefined)
    .map((data) => data as Cryptocurrency);
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(8)}`;
  }
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

/**
 * Format market cap for display
 */
export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  }
  return `$${marketCap.toFixed(2)}`;
}

/**
 * Calculate estimated fees based on market cap (mock calculation)
 */
export function calculateFees(marketCap: number, volume24h: number): number {
  // Estimate fees as 0.1% of 24h volume
  return volume24h * 0.001;
}

/**
 * Calculate liquidity depth based on market cap (mock calculation)
 */
export function calculateLiquidityDepth(marketCap: number): number {
  // Estimate liquidity depth as 5% of market cap
  return marketCap * 0.05;
}

