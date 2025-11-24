import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getCoinGeckoPlatforms, getCoinGeckoTopAssets, searchGlobalAssets, getAssetPlatforms, getTopAssetsForPlatform, getCoinDetails } from './server'
import type { CoinGeckoPlatform, CoinGeckoMarketCoin, CoinGeckoListCoin, CoinGeckoCoinDetails } from './types'

export function usePlatformsQuery() {
  const getPlatforms = useServerFn(getCoinGeckoPlatforms)
  return useQuery<CoinGeckoPlatform[]>({
    queryKey: ["coingecko-platforms"],
    queryFn: () => getPlatforms(),
    staleTime: 3600000,
    retry: (failureCount, error) =>
      error instanceof Error && error.message.includes("429") && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function useTopAssetsQuery() {
  const getTopAssets = useServerFn(getCoinGeckoTopAssets)
  return useQuery<CoinGeckoMarketCoin[]>({
    queryKey: ["coingecko-top-assets"],
    queryFn: () => getTopAssets(),
    staleTime: 3600000,
    retry: (failureCount, error) =>
      error instanceof Error && error.message.includes("429") && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function useAssetSearchQuery(query: string, platformId?: string) {
  const searchAssets = useServerFn(searchGlobalAssets)
  return useQuery<CoinGeckoListCoin[]>({
    queryKey: ["coingecko-search-assets", query, platformId],
    queryFn: () => searchAssets({ data: { query, platformId } }),
    enabled: query.length >= 2,
    staleTime: 60000,
    retry: (failureCount, error) =>
      error instanceof Error && error.message.includes("429") && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function useAssetPlatformsQuery(assetId: string | undefined) {
  const getPlatforms = useServerFn(getAssetPlatforms)
  return useQuery<Record<string, string>>({
    queryKey: ["coingecko-asset-platforms", assetId],
    queryFn: () => getPlatforms({ data: { assetId: assetId! } }),
    enabled: !!assetId,
    staleTime: 3600000,
  })
}

export function useTopAssetsForPlatformQuery(platformId: string | undefined) {
  const getAssets = useServerFn(getTopAssetsForPlatform)
  return useQuery<CoinGeckoMarketCoin[]>({
    queryKey: ["coingecko-top-assets-platform", platformId],
    queryFn: () => getAssets({ data: { platformId: platformId! } }),
    enabled: !!platformId,
    staleTime: 3600000,
    retry: (failureCount, error) =>
      error instanceof Error && error.message.includes("429") && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function useCoinDetailsQuery(coinId: string | undefined) {
  const getDetails = useServerFn(getCoinDetails)
  return useQuery<CoinGeckoCoinDetails>({
    queryKey: ["coingecko-coin-details", coinId],
    queryFn: () => getDetails({ data: { coinId: coinId! } }),
    enabled: !!coinId,
    staleTime: 3600000,
    retry: (failureCount, error) =>
      error instanceof Error && error.message.includes("429") && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}
