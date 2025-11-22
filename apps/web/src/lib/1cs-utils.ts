import { parse1cs, stringify1cs } from '@defuse-protocol/crosschain-assetid'
import type { Asset } from '@/types/common'

const CHAIN_MAPPING: Record<string, string> = {
  'eth': 'ethereum',
  'ethereum': 'ethereum',
  'base': 'base',
  'arb': 'arbitrum-one',
  'arbitrum': 'arbitrum-one',
  'arbitrum-one': 'arbitrum-one',
  'opt': 'optimism',
  'optimism': 'optimism',
  'poly': 'polygon-pos',
  'polygon': 'polygon-pos',
  'polygon-pos': 'polygon-pos',
  'bsc': 'binance-smart-chain',
  'binance-smart-chain': 'binance-smart-chain',
  'avax': 'avalanche',
  'avalanche': 'avalanche',
  'sol': 'solana',
  'solana': 'solana',
  'near': 'near-protocol',
  'near-protocol': 'near-protocol',
  'ftm': 'fantom',
  'fantom': 'fantom',
  'celo': 'celo',
  'moonbeam': 'moonbeam',
  'harmony': 'harmony-shard-0',
  'bera': 'berachain-artio',
}

const REVERSE_CHAIN_MAPPING: Record<string, string> = Object.entries(CHAIN_MAPPING).reduce(
  (acc, [key, value]) => {
    if (!acc[value] || key.length < acc[value].length) {
      acc[value] = key
    }
    return acc
  },
  {} as Record<string, string>
)

export function get1csChain(platformId: string): string {
  return REVERSE_CHAIN_MAPPING[platformId] || platformId
}

export function getPlatformId(chain1cs: string): string {
  return CHAIN_MAPPING[chain1cs.toLowerCase()] || chain1cs
}

export function assetTo1cs(asset: Asset): string {
  const chain = get1csChain(asset.blockchain)
  const namespace = getNamespaceForChain(asset.blockchain, asset.contractAddress)
  const reference = asset.contractAddress || 'coin'
  
  return stringify1cs({
    version: 'v1',
    chain,
    namespace,
    reference,
  })
}

export function parse1csToAsset(id1cs: string): Partial<Asset> | null {
  try {
    const parsed = parse1cs(id1cs)
    const platformId = getPlatformId(parsed.chain)
    
    return {
      blockchain: platformId,
      assetId: id1cs,
      contractAddress: parsed.reference === 'coin' ? undefined : parsed.reference,
    }
  } catch {
    return null
  }
}

function getNamespaceForChain(blockchain: string, address?: string): string {
  const normalizedSlug = blockchain.toLowerCase()
  const hasAddress = address !== undefined && address !== null && address !== ''

  const NON_EVM_CHAINS: Record<string, { tokenNamespace: string; nativeNamespace: string }> = {
    'solana': { tokenNamespace: 'spl', nativeNamespace: 'spl' },
    'near-protocol': { tokenNamespace: 'nep141', nativeNamespace: 'native' },
    'ton': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'aptos': { tokenNamespace: 'aptos-coin', nativeNamespace: 'aptos-coin' },
    'sui': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'bitcoin': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'dogecoin': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'litecoin': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'zcash': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'ripple': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'tron': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'cardano': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'stellar': { tokenNamespace: 'native', nativeNamespace: 'native' },
    'berachain-artio': { tokenNamespace: 'erc20', nativeNamespace: 'native' },
  }

  const chainDefaults = NON_EVM_CHAINS[normalizedSlug]
  if (chainDefaults) {
    return hasAddress ? chainDefaults.tokenNamespace : chainDefaults.nativeNamespace
  }

  return hasAddress ? 'erc20' : 'native'
}
