import { createServerFn } from '@tanstack/react-start'
import type { CoinGeckoPlatform, CoinGeckoTokenListResponse, CoinGeckoTokenListToken } from './types'

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3'
const CACHE_DURATION = 3600_000
const MAX_RETRIES = 3
const INITIAL_BACKOFF = 1000

const SUPPORTED_TOKEN_LIST_PLATFORMS = new Set<string>([
  'ethereum',
  'arbitrum-one',
  'polygon-pos',
  'binance-smart-chain',
  'base',
  'avalanche',
  'fantom',
  'optimism',
  'gnosis',
  'celo',
])

const TOKEN_LIST_PLATFORM_ID_MAP: Record<string, string> = {}

let platformsCache: { data: CoinGeckoPlatform[]; timestamp: number } | null = null
const tokensCache: Map<string, { data: CoinGeckoTokenListToken[]; timestamp: number }> = new Map()

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

export const getCoinGeckoPlatforms = createServerFn().handler(async () => {
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
    (p) => p.id && p.id.trim() !== '' && p.name && SUPPORTED_TOKEN_LIST_PLATFORMS.has(p.id),
  )

  platformsCache = { data: valid, timestamp: now }
  return valid
})

export const getCoinGeckoTokensByPlatform = createServerFn()
  .inputValidator((data: { platformId: string }) => data)
  .handler(async ({ data }) => {
    const rawId = data.platformId?.trim()
    if (!rawId) {
      return []
    }

    const platformId = TOKEN_LIST_PLATFORM_ID_MAP[rawId] ?? rawId

    const now = Date.now()

    const cached = tokensCache.get(platformId)
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }

    const response = await coingeckoFetch(`/token_lists/${platformId}/all.json`)
    
    if (response.status === 400 || response.status === 404) {
      console.warn('Unsupported token_list platform', { rawId, platformId, status: response.status })
      tokensCache.set(platformId, { data: [], timestamp: now })
      return []
    }

    if (!response.ok) {
      console.warn('getCoinGeckoTokensByPlatform failed', { rawId, platformId, status: response.status })
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const result: CoinGeckoTokenListResponse = await response.json()
    const tokens = result.tokens.filter((t) => t.symbol && t.name && t.address)

    tokensCache.set(platformId, { data: tokens, timestamp: now })
    return tokens
  })
