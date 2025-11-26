import { Atom } from "@effect-atom/atom-react"
import type { Asset } from "@/types/common"
import type { Network } from "@/lib/aggregator/hooks"

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

export const amountAtom = Atom.make<number>(100)
export const selectedProviderAtom = Atom.make<string>("across")
export const compareEnabledAtom = Atom.make<boolean>(false)

export const getDefaultSourceNetwork = (networks?: Network[]): string | undefined => {
  if (!networks || networks.length === 0) return undefined
  const ethereum = networks.find((n) => n.blockchain === "eth")
  return ethereum?.blockchain ?? networks[0]?.blockchain
}

export const getDefaultDestNetwork = (networks?: Network[]): string | undefined => {
  if (!networks || networks.length === 0) return undefined
  const arbitrum = networks.find((n) => n.blockchain === "arb")
  if (arbitrum) return arbitrum.blockchain
  if (networks.length > 1) return networks[1].blockchain
  return networks[0]?.blockchain
}

export const getDefaultAsset = (assets: Asset[]): Asset | null => {
  if (assets.length === 0) return null
  const usdc = assets.find((a) => a.symbol === "USDC" || a.symbol.includes("USD"))
  return usdc ?? assets[0]
}
