import type { CoinGeckoTokenListToken } from "./types"
import type { Asset } from "@/types/common"

export function tokenToAsset(token: CoinGeckoTokenListToken, platformId: string): Asset | null {
  if (!token.address || !platformId || !token.symbol) return null

  const assetId = `${token.symbol.toLowerCase()}-${platformId}-${token.address}`
  if (!assetId || assetId.includes("undefined") || assetId.includes("null")) return null

  return {
    blockchain: platformId,
    assetId,
    symbol: token.symbol.toUpperCase(),
    decimals: token.decimals,
    contractAddress: token.address,
    iconUrl: token.logoURI,
  }
}
