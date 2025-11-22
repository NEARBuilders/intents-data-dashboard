import { getStaticAssetsData } from '@/lib/coingecko/server'
import { useQuery } from '@tanstack/react-query'

export function useStaticAssets() {
  return useQuery({
    queryKey: ['static-assets-data'],
    queryFn: () => getStaticAssetsData(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function usePlatforms() {
  const { data, isLoading, error } = useStaticAssets()
  return {
    data: data?.platforms ?? [],
    isLoading,
    error,
  }
}

export function useTopAssetsForPlatform(platformId: string | undefined) {
  const { data, isLoading, error } = useStaticAssets()

  const filteredAssets = data?.assets.filter((asset) => {
    if (!platformId) return false
    return platformId in asset.platforms
  }) ?? []

  return {
    data: filteredAssets,
    isLoading,
    error,
  }
}
