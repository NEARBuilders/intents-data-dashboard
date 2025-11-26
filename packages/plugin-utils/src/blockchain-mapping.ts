/**
 * Canonical blockchain slug mapping
 * 
 * Single source of truth for chainId <-> blockchain slug conversions.
 */

/**
 * Non-EVM blockchains canonical list
 */
export const NON_EVM_BLOCKCHAINS = [
  "sol",
  "near",
  "ton",
  "aptos",
  "sui",
  "btc",
  "tron",
  "stellar",
  "cardano",
  "zec",
  "ltc",
  "doge",
  "xrp",
  "dot",
  "cosmos",
  "osmo",
  "algo",
  "tezos",
] as const;

export type NonEvmBlockchain = typeof NON_EVM_BLOCKCHAINS[number];

/**
 * Canonical blockchain slugs - single source of truth
 * All blockchain slugs exposed in APIs should come from this list
 */
export const CANONICAL_BLOCKCHAIN_SLUGS = [
  // EVM chains
  "eth",
  "arbitrum",
  "arbitrum-nova",
  "optimism",
  "base",
  "zora",
  "polygon",
  "polygon-zkevm",
  "bsc",
  "opbnb",
  "avax",
  "fantom",
  "celo",
  "gnosis",
  "zksync",
  "linea",
  "mantle",
  "scroll",
  "manta",
  "mode",
  "blast",
  "lisk",
  "redstone",
  "plasma",
  "bera",
  "unichain",
  "monad",
  "worldchain",
  "soneium",
  "ink",
  "gho",
  "wan",
  "oasys",
  "astar",
  "conflux",
  "metis",
  "moonbeam",
  "gravity",
  "kava",
  "oasis-sapphire",
  "flr",
  "cro",
  "fuse",
  "hedera-mainnet",
  "unut",
  "flow-mainnet",
  "glue",
  "vana",
  "abstract",
  "botanix",
  "nibiru-devnet-3",
  "kaia-mainnet",
  "iotaevm",
  "0g",
  "apechain",
  "hemi",
  "doma",
  "degen",
  "aurora",
  "goat",
  "lightlink_phoenix",
  
  // EVM Testnets
  "eth-ropsten",
  "eth-rinkeby",
  "eth-goerli",
  "eth-kovan",
  "eth-sepolia",
  "arbitrum-sepolia",
  "base-sepolia",
  "optimism-sepolia",
  "polygon-mumbai",
  
  // Non-EVM chains
  ...NON_EVM_BLOCKCHAINS,
] as const;

export type CanonicalBlockchain = typeof CANONICAL_BLOCKCHAIN_SLUGS[number];

/**
 * Canonical namespaces - single source of truth
 * All asset namespaces exposed in APIs should come from this list
 */
export const CANONICAL_NAMESPACES = [
  "erc20",
  "erc721",
  "erc1155",
  "spl",
  "nep141",
  "nep171",
  "near-nft",
  "native",
  "aptos-coin",
  "iso4217",
  "stellar-asset",
] as const;

export type CanonicalNamespace = typeof CANONICAL_NAMESPACES[number];

/**
 * Primary EVM chain mappings (chainId -> canonical blockchain slug)
 * This is the single source of truth for EVM chains
 */
const EVM_CHAIN_MAPPINGS = {
  // Ethereum Mainnet
  1: "eth",

  // Layer 2s
  42161: "arbitrum",
  42170: "arbitrum-nova",
  10: "optimism",
  8453: "base",
  7777777: "zora",

  // Polygon
  137: "polygon",
  1101: "polygon-zkevm",

  // BSC
  56: "bsc",
  204: "opbnb",

  // Avalanche
  43114: "avax",

  // Other EVM chains
  14: "flr",
  25: "cro",
  100: "gnosis",
  122: "fuse",
  130: "unichain",
  143: "monad",
  169: "manta",
  232: "gho",
  248: "oasys",
  250: "fantom",
  295: "hedera-mainnet",
  324: "zksync",
  480: "worldchain",
  484: "unut",
  592: "astar",
  690: "redstone",
  747: "flow-mainnet",
  999: "wan",
  1030: "conflux",
  1088: "metis",
  1135: "lisk",
  1284: "moonbeam",
  1300: "glue",
  1480: "vana",
  1625: "gravity",
  1868: "soneium",
  1890: "lightlink_phoenix",
  2222: "kava",
  2345: "goat",
  2741: "abstract",
  3637: "botanix",
  5000: "mantle",
  6900: "nibiru-devnet-3",
  8217: "kaia-mainnet",
  8822: "iotaevm",
  9745: "plasma",
  16661: "0g",
  23294: "oasis-sapphire",
  33139: "apechain",
  34443: "mode",
  42220: "celo",
  43111: "hemi",
  57073: "ink",
  59144: "linea",
  80094: "bera",
  81457: "blast",
  97477: "doma",
  534352: "scroll",
  666666666: "degen",
  1313161554: "aurora",

  // Testnets
  3: "eth-ropsten",
  4: "eth-rinkeby",
  5: "eth-goerli",
  42: "eth-kovan",
  11155111: "eth-sepolia",
  421614: "arbitrum-sepolia",
  84532: "base-sepolia",
  11155420: "optimism-sepolia",
  80001: "polygon-mumbai",
} as const;

/**
 * Blockchain canonical map: Single source of truth for normalization
 * Maps any name (canonical or alias) to the canonical slug
 */
const BLOCKCHAIN_CANONICAL_MAP: Record<string, string> = {
  // EVM chains - canonical names (identity mappings)
  "eth": "eth",
  "ethereum": "eth",
  "arbitrum": "arbitrum",
  "arb": "arbitrum",
  "arb1": "arbitrum",
  "arbitrum-nova": "arbitrum-nova",
  "arb-nova": "arbitrum-nova",
  "optimism": "optimism",
  "op": "optimism",
  "base": "base",
  "zora": "zora",
  "polygon": "polygon",
  "pol": "polygon",
  "matic": "polygon",
  "polygon-zkevm": "polygon-zkevm",
  "bsc": "bsc",
  "bnb": "bsc",
  "opbnb": "opbnb",
  "avax": "avax",
  "avalanche": "avax",
  "fantom": "fantom",
  "ftm": "fantom",
  "celo": "celo",
  "gnosis": "gnosis",
  "zksync": "zksync",
  "linea": "linea",
  "mantle": "mantle",
  "scroll": "scroll",
  "manta": "manta",
  "mode": "mode",
  "blast": "blast",
  "plasma": "plasma",
  "bera": "bera",
  "unichain": "unichain",
  "monad": "monad",
  "worldchain": "worldchain",
  "soneium": "soneium",
  "lisk": "lisk",
  "redstone": "redstone",
  "ink": "ink",
  "gho": "gho",
  "wan": "wan",
  "oasys": "oasys",
  "oas": "oasys",
  "astar": "astar",
  "astr": "astar",
  "conflux": "conflux",
  "cfx": "conflux",
  "metis": "metis",
  "moonbeam": "moonbeam",
  "glmr": "moonbeam",
  "gravity": "gravity",
  "g": "gravity",
  "kava": "kava",
  "oasis-sapphire": "oasis-sapphire",
  "oasis": "oasis-sapphire",
  "rose": "oasis-sapphire",
  "flr": "flr",
  "flare": "flr",
  "cro": "cro",
  "cronos": "cro",
  "fuse": "fuse",
  "hedera-mainnet": "hedera-mainnet",
  "hedera": "hedera-mainnet",
  "hbar": "hedera-mainnet",
  "unut": "unut",
  "flow-mainnet": "flow-mainnet",
  "flow": "flow-mainnet",
  "glue": "glue",
  "vana": "vana",
  "abstract": "abstract",
  "botanix": "botanix",
  "nibiru-devnet-3": "nibiru-devnet-3",
  "nibiru": "nibiru-devnet-3",
  "kaia-mainnet": "kaia-mainnet",
  "kaia": "kaia-mainnet",
  "iotaevm": "iotaevm",
  "iota": "iotaevm",
  "0g": "0g",
  "apechain": "apechain",
  "hemi": "hemi",
  "doma": "doma",
  "degen": "degen",
  "aurora": "aurora",
  "goat": "goat",
  "lightlink_phoenix": "lightlink_phoenix",
  "lightlink": "lightlink_phoenix",

  // Testnets
  "eth-ropsten": "eth-ropsten",
  "eth-rinkeby": "eth-rinkeby",
  "eth-goerli": "eth-goerli",
  "eth-kovan": "eth-kovan",
  "eth-sepolia": "eth-sepolia",
  "arbitrum-sepolia": "arbitrum-sepolia",
  "arb-sepolia": "arbitrum-sepolia",
  "base-sepolia": "base-sepolia",
  "optimism-sepolia": "optimism-sepolia",
  "op-sepolia": "optimism-sepolia",
  "polygon-mumbai": "polygon-mumbai",
  "pol-mumbai": "polygon-mumbai",
  "matic-mumbai": "polygon-mumbai",
  "mumbai": "polygon-mumbai",

  // Non-EVM chains - canonical
  "sol": "sol",
  "near": "near",
  "ton": "ton",
  "aptos": "aptos",
  "sui": "sui",
  "btc": "btc",
  "tron": "tron",
  "stellar": "stellar",
  "xlm": "stellar",
  "cardano": "cardano",
  "ada": "cardano",
  "zec": "zec",
  "ltc": "ltc",
  "doge": "doge",
  "xrp": "xrp",
  "dot": "dot",
  "polkadot": "dot",
  "cosmos": "cosmos",
  "atom": "cosmos",
  "osmo": "osmo",
  "osmosis": "osmo",
  "algo": "algo",
  "algorand": "algo",
  "tezos": "tezos",
  "xtz": "tezos"
};

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

  // Add reverse mappings for aliases from BLOCKCHAIN_CANONICAL_MAP
  for (const [name, canonicalSlug] of Object.entries(BLOCKCHAIN_CANONICAL_MAP)) {
    if (name !== canonicalSlug) {
      // This is an alias
      const chainId = map[canonicalSlug];
      if (chainId !== undefined) {
        map[name] = chainId;
      }
    }
  }

  return map;
})();

/**
 * Normalize a blockchain slug to its canonical form using direct lookup
 */
export function normalizeBlockchainSlug(blockchain: string): string {
  const lower = blockchain.toLowerCase();
  return BLOCKCHAIN_CANONICAL_MAP[lower] ?? lower;
}

const NON_EVM_NAMESPACE_CONFIG: Record<
  string,
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
  aptos: {
    tokenNamespace: 'aptos-coin',
    nativeNamespace: 'aptos-coin',
    nativeReference: encodeURIComponent('0x1::aptos_coin::AptosCoin'),
  },
  stellar: {
    tokenNamespace: 'stellar-asset',
    nativeNamespace: 'stellar-asset',
    nativeReference: 'native',
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
 * Check if an address is the EVM zero address (0x000...000)
 * Used to identify native coin placeholders in token lists
 */
export function isZeroAddress(address: string): boolean {
  return address.toLowerCase() === ZERO_ADDRESS;
}

/**
 * Get namespace and reference for a blockchain
 * Returns the appropriate namespace (e.g., erc20, spl, nep141, stellar-asset) and reference
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
    if (isZeroAddress(address)) {
      return { namespace: 'native', reference: 'coin' };
    }
    return { namespace: 'erc20', reference: address };
  } else {
    return { namespace: 'native', reference: 'coin' };
  }
}

/**
 * Get a default recipient address for quoting on a given blockchain
 * Returns a valid placeholder address for simulation purposes
 */
export function getDefaultRecipient(blockchain: string): string {
  const normalizedSlug = blockchain.toLowerCase() as NonEvmBlockchain;

  switch (normalizedSlug) {
    case 'sol':
      return '11111111111111111111111111111111';
    case 'near':
      return 'system.near';
    case 'aptos':
      return '0x1';
    case 'stellar':
      return 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    case 'ton':
      return 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    case 'btc':
      return '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    case 'tron':
      return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
    case 'cardano':
      return 'addr1qxy3w7l3v5wm0lqnpvw4w4wl3w5wm0lqnpvw4w4wl3w5wm0lqnpvw4w4wl3w5wm0lqnpvw4w4wl3w5wm0lqnpvw4sqqqqq';
    case 'xrp':
      return 'rNFB1oxEiSLXL3KWx1A7R5dA1wGFCt4L2k';
    case 'dot':
    case 'cosmos':
    case 'osmo':
      return 'cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0dyhf';
    default:
      return '0x0000000000000000000000000000000000000000';
  }
}
