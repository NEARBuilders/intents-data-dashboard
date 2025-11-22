import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getCoinGeckoPlatforms, getCoinGeckoTokensByPlatform } from './server'
import type { CoinGeckoTokenListToken, CoinGeckoPlatform } from './types'

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

export function useTokensQuery(platformId: string | undefined) {
  const getTokens = useServerFn(getCoinGeckoTokensByPlatform)
  return useQuery<CoinGeckoTokenListToken[]>({
    queryKey: ["coingecko-tokens", platformId],
    queryFn: () => getTokens({ data: { platformId: platformId! } }),
    enabled: !!platformId,
    staleTime: 3600000,
    retry: (failureCount, error) =>
      error instanceof Error && error.message.includes("429") && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}