import { Effect } from "every-plugin/effect";

interface ChainData {
  chainId: number;
  shortName: string;
  rpcUrls: string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorers?: Array<{
    name: string;
    url: string;
    standard: string;
  }>;
}

interface CachedChains {
  data: Map<number, ChainData>;
  lastFetch: number;
  ttl: number;
}

/**
 * Normalize chain slug from contract aliases to SDK canonical slugs
 */
function normalizeChainSlug(slug: string): string {
  // Map contract.ts aliases to SDK CAIP-2 canonical slugs
  const ALIASES_TO_CANONICAL: Record<string, string> = {
    'arb': 'arbitrum',
    'pol': 'polygon',
    'matic': 'polygon',
    'bnb': 'bsc',
    'op': 'optimism',
  };

  // Apply optional alias mapping, otherwise return as-is
  return ALIASES_TO_CANONICAL[slug.toLowerCase()] || slug.toLowerCase();
}

// Static mappings for non-EVM chains aligned to contract.ts CommonChains
const NON_EVM_CHAIN_DEFAULTS: Record<string, {
  tokenNamespace: string;      // When address IS provided
  nativeNamespace: string;     // When address is NOT provided
  nativeReference: string;     // Reference to use for native asset
}> = {
  // Solana
  'sol': {
    tokenNamespace: 'spl',
    nativeNamespace: 'spl',
    nativeReference: 'So11111111111111111111111111111112'  // Wrapped SOL
  },

  // NEAR
  'near': {
    tokenNamespace: 'nep141',  // Fungible tokens
    nativeNamespace: 'native',
    nativeReference: 'coin'
  },

  // TON
  'ton': {
    tokenNamespace: 'native',  // Using generic until specific token standard confirmed
    nativeNamespace: 'native',
    nativeReference: 'coin'
  },

  // Aptos
  'aptos': {
    tokenNamespace: 'aptos-coin',
    nativeNamespace: 'aptos-coin',
    nativeReference: encodeURIComponent('0x1::aptos_coin::AptosCoin')
  },

  // Sui
  'sui': {
    tokenNamespace: 'native',  // Using generic until specific token standard confirmed
    nativeNamespace: 'native',
    nativeReference: 'coin'
  },

  // Fiat (for currency references)
  'fiat': {
    tokenNamespace: 'iso4217',
    nativeNamespace: 'iso4217',
    nativeReference: 'USD'  // Default to USD
  }
};

// In-memory cache
let cachedChains: CachedChains | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch chain data from chainlist.network
 */
async function fetchChainList(): Promise<Map<number, ChainData>> {
  try {
    const response = await fetch('https://chainlist.org/api/v1/chains');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from chainlist`);
    }

    const chains = await response.json() as ChainData[];
    const chainMap = new Map<number, ChainData>();

    for (const chain of chains) {
      chainMap.set(chain.chainId, chain);
    }

    return chainMap;
  } catch (error: unknown) {
    throw new Error(`Failed to fetch chain list: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get chain data for a chainId with lazy caching
 */
export function getChainData(chainId: number): Effect.Effect<ChainData | null, Error> {
  return Effect.gen(function* () {
    // Check cache validity
    const now = Date.now();
    if (cachedChains && (now - cachedChains.lastFetch) < cachedChains.ttl) {
      return cachedChains.data.get(chainId) || null;
    }

    // Cache expired or empty, fetch fresh data
    try {
      const chains = yield* Effect.tryPromise({
        try: () => fetchChainList(),
        catch: (error: unknown) =>
          new Error(`Chain list fetch failed: ${error instanceof Error ? error.message : String(error)}`)
      });

      // Update cache
      cachedChains = {
        data: chains,
        lastFetch: now,
        ttl: CACHE_TTL
      };

      return chains.get(chainId) || null;
    } catch (error) {
      // If we have stale cache, return it rather than fail
      if (cachedChains) {
        console.warn('Using stale chain cache due to fetch error:', error);
        return cachedChains.data.get(chainId) || null;
      }
      throw error;
    }
  });
}


/**
 * Get normalized chain slug from chainId (using cache first)
 */
export function getChainSlug(chainId: number): Effect.Effect<string, Error> {
  return Effect.gen(function* () {
    const chainData = yield* getChainData(chainId);

    if (!chainData || !chainData.shortName) {
      throw new Error(`Unknown chain ID: ${chainId}`);
    }

    // Apply slug normalization for SDK canonical slugs
    return normalizeChainSlug(chainData.shortName);
  });
}

/**
 * Get namespace mapping for a chain slug and optional address
 */
export function getChainNamespace(chainSlug: string, address?: string): {
  namespace: string;
  reference: string;
} {
  const normalizedSlug = normalizeChainSlug(chainSlug);
  const hasAddress = address !== undefined && address !== null && address !== '';

  // Check non-EVM chain mappings first
  const chainDefaults = NON_EVM_CHAIN_DEFAULTS[normalizedSlug];
  if (chainDefaults) {
    if (hasAddress) {
      return {
        namespace: chainDefaults.tokenNamespace,
        reference: address
      };
    } else {
      return {
        namespace: chainDefaults.nativeNamespace,
        reference: chainDefaults.nativeReference
      };
    }
  }

  // Default to EVM patterns
  if (hasAddress) {
    return { namespace: 'erc20', reference: address };
  } else {
    return { namespace: 'native', reference: 'coin' };
  }
}

/**
 * Get JSON export of cached chains
 */
export function getCachedChains(): { count: number; lastFetch: number; data: Record<number, ChainData> } | null {
  if (!cachedChains) {
    return null;
  }

  const data: Record<number, ChainData> = {};
  for (const [chainId, chainData] of cachedChains.data.entries()) {
    data[chainId] = chainData;
  }

  return {
    count: cachedChains.data.size,
    lastFetch: cachedChains.lastFetch,
    data
  };
}

/**
 * Clear cache
 */
export function clearChainCache(): void {
  cachedChains = null;
}
