import { Atom } from "@effect-atom/atom-react"
import type { CoinGeckoPlatform } from "@/lib/coingecko/types"
import type { Asset } from "@/types/common"

export interface CoinListItem {
  id: string
  symbol: string
  name: string
  platforms: Record<string, string>
}

export const sourceNetworkIdAtom = Atom.make<string | undefined>(undefined)
export const destNetworkIdAtom = Atom.make<string | undefined>(undefined)

export const sourceAssetAtom = Atom.make<Asset | null>(null)
export const destAssetAtom = Atom.make<Asset | null>(null)

export const getDefaultSourceNetwork = (platforms?: CoinGeckoPlatform[]): string | undefined => {
  if (!platforms || platforms.length === 0) return undefined
  const ethereum = platforms.find((p) => p.id === "ethereum")
  return ethereum?.id ?? platforms[0]?.id
}

export const getDefaultDestNetwork = (platforms?: CoinGeckoPlatform[]): string | undefined => {
  if (!platforms || platforms.length === 0) return undefined
  const arbitrum = platforms.find((p) => p.id === "arbitrum-one")
  if (arbitrum) return arbitrum.id
  if (platforms.length > 1) return platforms[1].id
  return platforms[0]?.id
}

export const getDefaultAsset = (assets: Asset[]): Asset | null => {
  if (assets.length === 0) return null
  const usdc = assets.find((a) => a.symbol === "USDC" || a.symbol.includes("USD"))
  return usdc ?? assets[0]
}
