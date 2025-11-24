/**
 * Canonical blockchain slug mapping
 * 
 * Single source of truth for chainId <-> blockchain slug conversions.
 */

/**
 * Primary EVM chain mappings (chainId -> canonical blockchain slug)
 * This is the single source of truth for EVM chains
 */
const EVM_CHAIN_MAPPINGS = {
  // Ethereum Mainnet
  1: "eth",
  
  // Layer 2s
  42161: "arb",
  42170: "arb-nova",
  10: "op",
  8453: "base",
  7777777: "zora",
  
  // Polygon
  137: "pol",
  1101: "polygon-zkevm",
  
  // BSC
  56: "bsc",
  204: "opbnb",
  
  // Avalanche
  43114: "avax",
  
  // Other EVM chains
  250: "ftm",
  42220: "celo",
  100: "gnosis",
  324: "zksync",
  59144: "linea",
  5000: "mantle",
  534352: "scroll",
  169: "manta",
  34443: "mode",
  81457: "blast",
  
  // Emerging L2s
  9745: "plasma",
  80094: "bera",
  130: "unichain",
  143: "monad",
  480: "worldchain",
  1868: "soneium",
  
  // Testnets
  3: "eth-ropsten",
  4: "eth-rinkeby",
  5: "eth-goerli",
  42: "eth-kovan",
  11155111: "eth-sepolia",
  421614: "arb-sepolia",
  84532: "base-sepolia",
  11155420: "op-sepolia",
  80001: "pol-mumbai",
} as const;

/**
 * Blockchain slug aliases (alternative names -> canonical slug)
 * These provide alternative names that map to the same chainId
 */
const BLOCKCHAIN_ALIASES = {
  "polygon": "pol",
  "matic": "pol",
  "bnb": "bsc",
  "avalanche": "avax",
  "fantom": "ftm",
  "matic-mumbai": "pol-mumbai",
  "mumbai": "pol-mumbai",
} as const;

/**
 * Non-EVM chain ID mappings (string chainId -> blockchain slug)
 * For chains that use non-standard numeric identifiers
 */
const NON_EVM_CHAIN_ID_MAP: Record<string, string> = {
  // Solana - various provider representations
  "34268394551451": "sol",
  "1399811149": "sol",
  "501000101": "sol",
  
  // Bitcoin - some providers use these
  "0": "btc",
  "8332": "btc",
  
  // Tron
  "728126428": "tron",

  // NEAR
  "397": "near",
};

/**
 * Generated: chainId -> blockchain slug map
 */
export const CHAIN_ID_TO_BLOCKCHAIN: Record<number, string> = { ...EVM_CHAIN_MAPPINGS };

/**
 * Generated: blockchain slug -> chainId map (includes aliases)
 */
export const BLOCKCHAIN_TO_CHAIN_ID: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  
  for (const [chainId, slug] of Object.entries(EVM_CHAIN_MAPPINGS)) {
    map[slug] = Number(chainId);
  }
  
  for (const [alias, canonicalSlug] of Object.entries(BLOCKCHAIN_ALIASES)) {
    const chainId = map[canonicalSlug];
    if (chainId !== undefined) {
      map[alias] = chainId;
    }
  }
  
  return map;
})();

export const NON_EVM_BLOCKCHAINS = [
  "sol",
  "near",
  "ton",
  "aptos",
  "sui",
  "btc",
  "zec",
  "ltc",
  "doge",
  "xrp",
  "xlm",
  "ada",
  "dot",
  "cosmos",
  "osmo",
  "atom",
  "algo",
  "tezos",
  "xtz",
] as const;

export type NonEvmBlockchain = typeof NON_EVM_BLOCKCHAINS[number];

const NON_EVM_NAMESPACE_CONFIG: Record<
  NonEvmBlockchain,
  { tokenNamespace: string; nativeNamespace: string; nativeReference: string }
> = {
  sol: {
    tokenNamespace: 'spl',
    nativeNamespace: 'spl',
    nativeReference: 'So11111111111111111111111111111111111111112',
  },
  near: {
    tokenNamespace: 'nep141',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  ton: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  aptos: {
    tokenNamespace: 'aptos-coin',
    nativeNamespace: 'aptos-coin',
    nativeReference: encodeURIComponent('0x1::aptos_coin::AptosCoin'),
  },
  sui: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  btc: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  zec: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  ltc: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  doge: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  xrp: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  xlm: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  ada: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  dot: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  cosmos: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  osmo: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  atom: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  algo: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  tezos: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
  xtz: {
    tokenNamespace: 'native',
    nativeNamespace: 'native',
    nativeReference: 'coin',
  },
};

interface ChainIdNetworkChain {
  chainId: number;
  name: string;
  shortName?: string;
  chain?: string;
  network?: string;
  networkId?: number;
}

let chainIdNetworkCache: Map<number, string> | null = null;
let chainIdNetworkFetchPromise: Promise<void> | null = null;

function normalizeChainName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchChainIdNetworkData(): Promise<void> {
  if (chainIdNetworkCache !== null) {
    return;
  }

  try {
    const response = await fetch('https://chainid.network/chains.json');
    if (!response.ok) {
      console.warn('[blockchain-mapping] Failed to fetch chainid.network data');
      chainIdNetworkCache = new Map();
      return;
    }

    const chains = (await response.json()) as ChainIdNetworkChain[];
    chainIdNetworkCache = new Map();

    for (const chain of chains) {
      if (chain.chainId && chain.name) {
        const slug = chain.shortName 
          ? normalizeChainName(chain.shortName)
          : normalizeChainName(chain.name);
        chainIdNetworkCache.set(chain.chainId, slug);
      }
    }

    console.log(`[blockchain-mapping] Cached ${chainIdNetworkCache.size} chains from chainid.network`);
  } catch (error) {
    console.warn('[blockchain-mapping] Error fetching chainid.network data:', error);
    chainIdNetworkCache = new Map();
  }
}

/**
 * Get blockchain slug from chain ID (supports both EVM and non-EVM chains)
 * Falls back to chainid.network if not found in hardcoded maps
 */
export function getBlockchainFromChainId(chainId: number | string): string | null {
  const chainIdStr = String(chainId);
  
  const nonEvmBlockchain = NON_EVM_CHAIN_ID_MAP[chainIdStr];
  if (nonEvmBlockchain) {
    return nonEvmBlockchain;
  }

  const numericChainId = typeof chainId === "number" ? chainId : parseInt(chainIdStr, 10);
  const result = CHAIN_ID_TO_BLOCKCHAIN[numericChainId];
  
  if (result) {
    return result;
  }

  if (chainIdNetworkCache !== null) {
    const fallbackResult = chainIdNetworkCache.get(numericChainId);
    if (fallbackResult) {
      console.warn(
        `[blockchain-mapping] Unknown chainId: ${chainId} - using fallback slug '${fallbackResult}' from chainid.network. ` +
        `Please add to CHAIN_ID_TO_BLOCKCHAIN for better performance.`
      );
      return fallbackResult;
    }
  }

  if (chainIdNetworkFetchPromise === null && chainIdNetworkCache === null) {
    chainIdNetworkFetchPromise = fetchChainIdNetworkData().finally(() => {
      chainIdNetworkFetchPromise = null;
    });
  }
  
  console.warn(`[blockchain-mapping] Unknown chainId: ${chainId} - please add to CHAIN_ID_TO_BLOCKCHAIN or NON_EVM_CHAIN_ID_MAP`);
  
  return null;
}

/**
 * Get chain ID from blockchain slug
 */
export function getChainIdFromBlockchain(blockchain: string): number | null {
  const normalized = blockchain.toLowerCase();
  const result = BLOCKCHAIN_TO_CHAIN_ID[normalized] || null;
  
  if (!result && !isNonEvmBlockchain(blockchain)) {
    console.warn(`[blockchain-mapping] Unknown blockchain slug: ${blockchain} - please add to BLOCKCHAIN_TO_CHAIN_ID`);
  }
  
  return result;
}

/**
 * Check if a blockchain is EVM-compatible
 */
export function isEvmBlockchain(blockchain: string): boolean {
  return getChainIdFromBlockchain(blockchain) !== null;
}

/**
 * Check if a blockchain is non-EVM
 */
export function isNonEvmBlockchain(blockchain: string): blockchain is NonEvmBlockchain {
  return (NON_EVM_BLOCKCHAINS as readonly string[]).includes(blockchain);
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Get namespace and reference for a blockchain
 * Returns the appropriate namespace (e.g., erc20, spl, nep141) and reference
 * based on whether the asset has an address/contract or is native
 * 
 * Automatically normalizes EVM zero address (0x000...000) to native:coin
 */
export function getChainNamespace(
  blockchain: string,
  address?: string
): { namespace: string; reference: string } {
  const normalizedSlug = blockchain.toLowerCase() as NonEvmBlockchain;
  const hasAddress = address !== undefined && address !== null && address !== '';

  const chainDefaults = NON_EVM_NAMESPACE_CONFIG[normalizedSlug];
  if (chainDefaults) {
    if (hasAddress) {
      return { namespace: chainDefaults.tokenNamespace, reference: address };
    } else {
      return {
        namespace: chainDefaults.nativeNamespace,
        reference: chainDefaults.nativeReference,
      };
    }
  }

  if (hasAddress) {
    if (address.toLowerCase() === ZERO_ADDRESS) {
      return { namespace: 'native', reference: 'coin' };
    }
    return { namespace: 'erc20', reference: address };
  } else {
    return { namespace: 'native', reference: 'coin' };
  }
}
