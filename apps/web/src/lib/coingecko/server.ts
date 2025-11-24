import { createServerFn } from '@tanstack/react-start'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'
import { parse1cs } from '@defuse-protocol/crosschain-assetid'
import { getPlatformId } from '@/lib/1cs-utils'
import type { CoinGeckoPlatform, CoinGeckoMarketCoin, CoinGeckoListCoin, EnrichedAsset } from './types'

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3'
const CACHE_DURATION = 3600_000
const MAX_RETRIES = 3
const INITIAL_BACKOFF = 1000

let platformsCache: { data: CoinGeckoPlatform[]; timestamp: number } | null = null
let marketCoinsCache: { data: CoinGeckoMarketCoin[]; timestamp: number } | null = null
let globalCoinsCache: { data: CoinGeckoListCoin[]; timestamp: number } | null = null

async function coingeckoFetch(path: string): Promise<Response> {
  const apiKey = process.env.COINGECKO_API_KEY
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['x-cg-pro-api-key'] = apiKey

  let retries = 0
  let response: Response

  while (true) {
    response = await fetch(`${COINGECKO_BASE_URL}${path}`, { headers })

    if (response.status !== 429 || retries >= MAX_RETRIES) {
      if (response.status === 429 && retries >= MAX_RETRIES) {
        console.warn('CoinGecko rate limit exceeded after retries', { path, retries })
      }
      break
    }

    const backoff = INITIAL_BACKOFF * Math.pow(2, retries)
    console.warn('CoinGecko rate limit hit, retrying', { path, retries, backoffMs: backoff })
    await new Promise((r) => setTimeout(r, backoff))
    retries += 1
  }

  return response
}

async function getPlatformsInternal(): Promise<CoinGeckoPlatform[]> {
  const now = Date.now()
  if (platformsCache && now - platformsCache.timestamp < CACHE_DURATION) {
    return platformsCache.data
  }

  const response = await coingeckoFetch('/asset_platforms')
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`)
  }

  const allPlatforms: CoinGeckoPlatform[] = await response.json()
  const valid = allPlatforms.filter(
    (p) => p.id && p.id.trim() !== '' && p.name
  ).sort((a, b) => a.name.localeCompare(b.name))

  platformsCache = { data: valid, timestamp: now }
  return valid
}

export const getCoinGeckoPlatforms = createServerFn().handler(async () => {
  return await getPlatformsInternal()
})

interface StaticAssetsData {
  platforms: CoinGeckoPlatform[]
  assets: EnrichedAsset[]
  generated_at: string
}

export const getStaticAssetsData = createServerFn({ method: 'GET' })
  .middleware([staticFunctionMiddleware as any])
  .handler(async (): Promise<StaticAssetsData> => {
    const [platforms, topAssets, globalAssets] = await Promise.all([
      (async () => {
        const response = await coingeckoFetch('/asset_platforms')
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)
        const allPlatforms: CoinGeckoPlatform[] = await response.json()
        return allPlatforms.filter(
          (p) => p.id && p.id.trim() !== '' && p.name
        ).sort((a, b) => a.name.localeCompare(b.name))
      })(),
      (async () => {
        const response = await coingeckoFetch('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false')
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)
        return await response.json() as CoinGeckoMarketCoin[]
      })(),
      (async () => {
        const response = await coingeckoFetch('/coins/list?include_platform=true')
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)
        return await response.json() as CoinGeckoListCoin[]
      })(),
    ])

    const globalMap = new Map(globalAssets.map((coin) => [coin.id, coin]))
    const enrichedAssets: EnrichedAsset[] = topAssets.map((asset) => {
      const globalCoin = globalMap.get(asset.id)
      return {
        ...asset,
        platforms: globalCoin?.platforms || {},
      }
    })

    return {
      platforms,
      assets: enrichedAssets,
      generated_at: new Date().toISOString(),
    }
  })

export const getCoinGeckoTopAssets = createServerFn().handler(async () => {
  const now = Date.now()
  if (marketCoinsCache && now - marketCoinsCache.timestamp < CACHE_DURATION) {
    return marketCoinsCache.data
  }

  const response = await coingeckoFetch('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false')
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`)
  }

  const coins: CoinGeckoMarketCoin[] = await response.json()
  marketCoinsCache = { data: coins, timestamp: now }
  return coins
})

export const getTopAssetsForPlatform = createServerFn()
  .inputValidator((data: { platformId: string }) => data)
  .handler(async ({ data }) => {
    const [topAssets, globalAssets] = await Promise.all([
      (async () => {
        const now = Date.now()
        if (marketCoinsCache && now - marketCoinsCache.timestamp < CACHE_DURATION) {
          return marketCoinsCache.data
        }
        const response = await coingeckoFetch('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false')
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)
        const coins: CoinGeckoMarketCoin[] = await response.json()
        marketCoinsCache = { data: coins, timestamp: now }
        return coins
      })(),
      getGlobalAssetsInternal(),
    ])

    const platformId = data.platformId
    
    return topAssets.filter((topAsset) => {
      const globalCoin = globalAssets.find((c) => c.id === topAsset.id)
      return globalCoin?.platforms && platformId in globalCoin.platforms
    })
  })

async function getGlobalAssetsInternal(): Promise<CoinGeckoListCoin[]> {
  const now = Date.now()
  if (globalCoinsCache && now - globalCoinsCache.timestamp < CACHE_DURATION) {
    return globalCoinsCache.data
  }

  const response = await coingeckoFetch('/coins/list?include_platform=true')
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`)
  }

  const coins: CoinGeckoListCoin[] = await response.json()
  globalCoinsCache = { data: coins, timestamp: now }
  return coins
}

export const searchGlobalAssets = createServerFn()
  .inputValidator((data: { query: string; platformId?: string }) => data)
  .handler(async ({ data }) => {
    const globalCoins = await getGlobalAssetsInternal()
    const query = data.query?.toLowerCase().trim() || ''
    
    if (!query) {
      return []
    }

    const matches = globalCoins.filter((coin) => {
      const matchesQuery = 
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query) ||
        coin.id.toLowerCase().includes(query)
      
      if (!matchesQuery) return false
      
      if (data.platformId) {
        return coin.platforms && data.platformId in coin.platforms
      }
      
      return true
    })

    return matches.slice(0, 100)
  })

export const getAssetPlatforms = createServerFn()
  .inputValidator((data: { assetId: string }) => data)
  .handler(async ({ data }) => {
    const globalCoins = await getGlobalAssetsInternal()
    const coin = globalCoins.find((c) => c.id === data.assetId)
    return coin?.platforms || {}
  })

export const getCoinDetails = createServerFn()
  .inputValidator((data: { coinId: string }) => data)
  .handler(async ({ data }) => {
    let resolvedCoinId = data.coinId

    if (data.coinId.startsWith('1cs:')) {
      try {
        const parsed = parse1cs(data.coinId)
        const platformId = getPlatformId(parsed.chain)
        
        if (parsed.reference && parsed.reference !== 'coin') {
          const contractResponse = await coingeckoFetch(`/coins/${platformId}/contract/${parsed.reference}`)
          if (!contractResponse.ok) {
            throw new Error(`CoinGecko API error: ${contractResponse.status}`)
          }
          return await contractResponse.json() as import('./types').CoinGeckoCoinDetails
        } else {
          const platforms = await getPlatformsInternal()
          const platform = platforms.find((p: CoinGeckoPlatform) => p.id === platformId)
          if (platform?.native_coin_id) {
            resolvedCoinId = platform.native_coin_id
          } else {
            throw new Error(`Unable to resolve native coin for platform: ${platformId}`)
          }
        }
      } catch (error) {
        console.error('Error parsing 1cs ID:', data.coinId, error)
        throw new Error(`Invalid 1cs ID or unable to resolve: ${data.coinId}`)
      }
    }

    const response = await coingeckoFetch(`/coins/${resolvedCoinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }
    return await response.json() as import('./types').CoinGeckoCoinDetails
  })
