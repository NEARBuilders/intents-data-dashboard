/**
 * Canonical blockchain slug mapping
 * 
 * This is the single source of truth for chainId <-> blockchain slug conversions.
 */

export const CHAIN_ID_TO_BLOCKCHAIN: Record<number, string> = {
  // Ethereum Mainnet
  1: "eth",
  
  // Layer 2s
  42161: "arb",      // Arbitrum One
  42170: "arb-nova", // Arbitrum Nova
  10: "op",          // Optimism
  8453: "base",      // Base
  7777777: "zora",   // Zora
  
  // Polygon
  137: "pol",        // Polygon PoS
  1101: "polygon-zkevm", // Polygon zkEVM
  
  // BSC
  56: "bsc",         // BNB Smart Chain
  204: "opbnb",      // opBNB
  
  // Avalanche
  43114: "avax",     // Avalanche C-Chain
  
  // Other EVM chains
  250: "ftm",        // Fantom
  42220: "celo",     // Celo
  100: "gnosis",     // Gnosis Chain
  324: "zksync",     // zkSync Era
  59144: "linea",    // Linea
  5000: "mantle",    // Mantle
  534352: "scroll",  // Scroll
  169: "manta",      // Manta Pacific
  34443: "mode",     // Mode
  81457: "blast",    // Blast
  
  // Testnets (commonly used)
  11155111: "eth",   // Sepolia
  421614: "arb",     // Arbitrum Sepolia
  84532: "base",     // Base Sepolia
  11155420: "op",    // Optimism Sepolia
  
  // Emerging L2s
  9745: "plasma",    // Soon
  80094: "bera",     // Berachain (testnet)
};

export const BLOCKCHAIN_TO_CHAIN_ID: Record<string, number> = {
  "eth": 1,
  "arb": 42161,
  "arb-nova": 42170,
  "op": 10,
  "base": 8453,
  "zora": 7777777,
  "pol": 137,
  "polygon": 137,      // alias
  "matic": 137,        // legacy alias
  "polygon-zkevm": 1101,
  "bsc": 56,
  "bnb": 56,           // alias
  "opbnb": 204,
  "avax": 43114,
  "avalanche": 43114,  // alias
  "ftm": 250,
  "fantom": 250,       // alias
  "celo": 42220,
  "gnosis": 100,
  "zksync": 324,
  "linea": 59144,
  "mantle": 5000,
  "scroll": 534352,
  "manta": 169,
  "mode": 34443,
  "blast": 81457,
  "plasma": 9745,
  "bera": 80094,
};

/**
 * Non-EVM chains that don't have numeric chain IDs
 */
export const NON_EVM_BLOCKCHAINS = [
  "sol",     // Solana
  "near",    // NEAR Protocol
  "ton",     // TON
  "aptos",   // Aptos
  "sui",     // Sui
  "btc",     // Bitcoin
  "zec",     // Zcash
  "ltc",     // Litecoin
  "doge",    // Dogecoin
  "xrp",     // Ripple
  "xlm",     // Stellar
  "ada",     // Cardano
  "dot",     // Polkadot
  "cosmos",  // Cosmos Hub
  "osmo",    // Osmosis
  "atom",    // Cosmos (alias)
  "algo",    // Algorand
  "tezos",   // Tezos
  "xtz",     // Tezos (alias)
] as const;

export type NonEvmBlockchain = typeof NON_EVM_BLOCKCHAINS[number];

/**
 * Get blockchain slug from chain ID
 */
export function getBlockchainFromChainId(chainId: number): string | null {
  return CHAIN_ID_TO_BLOCKCHAIN[chainId] || null;
}

/**
 * Get chain ID from blockchain slug
 */
export function getChainIdFromBlockchain(blockchain: string): number | null {
  const normalized = blockchain.toLowerCase();
  return BLOCKCHAIN_TO_CHAIN_ID[normalized] || null;
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
