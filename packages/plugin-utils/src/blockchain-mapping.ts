interface ChainData {
  name: string;
  chain: string;
  chainId: number;
  networkId: number;
  shortName: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

let chainCache: ChainData[] | null = null;

async function loadChains(): Promise<ChainData[]> {
  if (chainCache) return chainCache;

  const response = await fetch('https://chainid.network/chains.json');
  if (!response.ok) {
    throw new Error(`Chainlist API failed: ${response.status}`);
  }

  chainCache = await response.json() as ChainData[];
  return chainCache;
}

const NON_EVM_CHAIN_ID_MAP: Record<string, string> = {
  // Solana - various provider representations
  "34268394551451": "sol",
  "1399811149": "sol", // Solana mainnet alternative ID
  
  // Bitcoin - some providers use these
  "0": "btc",
  "8332": "btc",
  
  // Tron
  "728126428": "tron",

  "397": "near",
};

const SHORTNAME_CANONICAL_MAP: Record<string, string> = {
  eth: "eth",

  arb1: "arb",
  arb: "arb",
  arbitrum: "arb",

  oeth: "op",
  op: "op",
  optimism: "op",

  matic: "pol",
  pol: "pol",
  polygon: "pol",

  bsc: "bsc",
  bnb: "bsc",

  base: "base",

  avax: "avax",
  avalanche: "avax",

  ftm: "ftm",
  celo: "celo",
  zksync: "zksync",
  linea: "linea",
  mantle: "mantle",
  scroll: "scroll",
  "polygon-zkevm": "polygon-zkevm",
  opbnb: "opbnb",
};

function normalizeBlockchainName(blockchain: string): string {
  const normalized = blockchain.toLowerCase().trim();

  if (normalized.startsWith('arb') || normalized === 'arbitrum') {
    return 'arb1';
  }

  return normalized;
}

export async function getChainByName(blockchain: string): Promise<ChainData | null> {
  const chains = await loadChains();

  const normalized = normalizeBlockchainName(blockchain);
  return chains.find(c =>
    c.shortName?.toLowerCase() === normalized
  ) ?? null;
}

export async function getChainId(blockchain: string): Promise<number | null> {
  const chain = await getChainByName(blockchain);
  return chain?.chainId ?? null;
}

export async function getBlockchainFromChainId(chainId: string): Promise<string | null> {
  const nonEvmBlockchain = NON_EVM_CHAIN_ID_MAP[chainId];
  if (nonEvmBlockchain) {
    return nonEvmBlockchain;
  }

  const chains = await loadChains();
  const numericChainId = parseInt(chainId, 10);
  const chain = chains.find(c => c.chainId === numericChainId);

  if (!chain?.shortName) {
    return null;
  }

  const normalizedShortName = chain.shortName.toLowerCase();
  const canonical = SHORTNAME_CANONICAL_MAP[normalizedShortName];
  
  return canonical ?? normalizedShortName;
}
