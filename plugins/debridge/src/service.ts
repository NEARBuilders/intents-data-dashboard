import { DataProviderService as BaseDataProviderService, assetToCanonicalIdentity, canonicalToAsset, getChainIdFromBlockchain, calculateEffectiveRate, getDefaultRecipient, getBlockchainFromChainId } from "@data-provider/plugin-utils";
import { DeBridgeApiClient, DeBridgeAssetType, type DefiLlamaBridgeResponse } from "./client";
import type {
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType,
  AssetType
} from "@data-provider/shared-contract";

export class DeBridgeService extends BaseDataProviderService<DeBridgeAssetType> {
  constructor(private readonly client: DeBridgeApiClient) {
    super();
  }

  async transformAssetToProvider(asset: AssetType): Promise<DeBridgeAssetType> {
    const identity = await assetToCanonicalIdentity(asset);
    const chainId = getChainIdFromBlockchain(identity.blockchain);
    if (!chainId) {
      throw new Error(`Unsupported chain: ${identity.blockchain}`);
    }
    return {
      chainId: chainId.toString(),
      address: identity.reference,
      symbol: asset.symbol,
      decimals: asset.decimals
    };
  }

  async transformAssetFromProvider(asset: DeBridgeAssetType): Promise<AssetType> {
    const identity = await assetToCanonicalIdentity({
      chainId: asset.chainId,
      address: asset.address!
    });

    return canonicalToAsset(identity, {
      symbol: asset.symbol!,
      decimals: asset.decimals!
    });
  }

  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.client.fetchDefiLlamaVolumes();
      return this.mapVolumesToWindows(bridgeData, windows);
    } catch (error) {
      console.error("[deBridge] Failed to fetch volumes from DefiLlama:", error);
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  private mapVolumesToWindows(bridgeData: DefiLlamaBridgeResponse, windows: TimeWindow[]): VolumeWindowType[] {
    const volumes: VolumeWindowType[] = [];
    const now = new Date().toISOString();

    for (const window of windows) {
      let volumeUsd: number | undefined;
      switch (window) {
        case "24h":
          volumeUsd = bridgeData.lastDailyVolume;
          break;
        case "7d":
          volumeUsd = bridgeData.weeklyVolume;
          break;
        case "30d":
          volumeUsd = bridgeData.monthlyVolume;
          break;
      }
      if (volumeUsd !== undefined) {
        volumes.push({ window, volumeUsd, measuredAt: now });
        console.log(`[deBridge] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }
    }
    return volumes;
  }

  async getListedAssets(): Promise<DeBridgeAssetType[]> {
    try {
      const chainsInfo = await this.client.fetchSupportedChains();
      const assets: DeBridgeAssetType[] = [];
      const seen = new Set<string>();

      for (const [chainIdStr, chainData] of Object.entries(chainsInfo)) {
        if (!chainData || typeof chainData !== 'object') {
          continue;
        }

        if (chainData.tokens && typeof chainData.tokens === 'object') {
          for (const [tokenAddress, tokenInfo] of Object.entries(chainData.tokens)) {
            if (!tokenInfo || typeof tokenInfo !== 'object') {
              continue;
            }

            if (!tokenInfo.address) {
              continue;
            }

            const assetId = tokenInfo.address.toLowerCase();
            const key = `${chainIdStr}:${assetId}`;
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);

            const decimalsRaw = typeof tokenInfo.decimals === 'number'
              ? tokenInfo.decimals
              : Number.parseInt(String(tokenInfo.decimals ?? '18'), 10);
            const decimals = Number.isFinite(decimalsRaw) ? decimalsRaw : 18;

            assets.push({
              chainId: chainIdStr,
              address: assetId,
              symbol: tokenInfo.symbol ?? tokenInfo.name ?? tokenAddress,
              decimals,
            });
          }
        }
      }

      console.log(`[deBridge] Fetched ${assets.length} assets from supported-chains-info`);
      return assets;
    } catch (error) {
      console.error("[deBridge] Failed to fetch listed assets:", error);
      return [];
    }
  }

  async getRates(route: RouteType<DeBridgeAssetType>, amount: string): Promise<RateType<DeBridgeAssetType>[]> {
    const rates: RateType<DeBridgeAssetType>[] = [];

    try {
      const sourceBlockchain = getBlockchainFromChainId(parseInt(route.source.chainId));
      const destBlockchain = getBlockchainFromChainId(parseInt(route.destination.chainId));
      
      if (!sourceBlockchain || !destBlockchain) {
        console.error(`[deBridge] Unable to resolve blockchains for chainIds ${route.source.chainId}, ${route.destination.chainId}`);
        return rates;
      }

      const authorityAddress = getDefaultRecipient(sourceBlockchain);
      const recipient = getDefaultRecipient(destBlockchain);

      const quote = await this.client.fetchQuote({
        srcChainId: parseInt(route.source.chainId),
        srcChainTokenIn: route.source.address!,
        srcChainTokenInAmount: amount,
        dstChainId: parseInt(route.destination.chainId),
        dstChainTokenOut: route.destination.address!,
        dstChainTokenOutAmount: 'auto',
        dstChainTokenOutRecipient: recipient,
        dstChainOrderAuthorityAddress: authorityAddress,
        srcChainOrderAuthorityAddress: authorityAddress,
        prependOperatingExpenses: 'true'
      });

      if (!quote?.estimation) {
        throw new Error('Invalid quote response structure');
      }

      const srcToken = quote.estimation.srcChainTokenIn;
      const dstToken = quote.estimation.dstChainTokenOut;

      const fromAmount = srcToken.amount;
      const toAmount = dstToken.recommendedAmount ?? dstToken.amount;

      if (!fromAmount || !toAmount) {
        throw new Error('Missing amount data in quote estimation');
      }

      const effectiveRate = calculateEffectiveRate(
        fromAmount,
        toAmount,
        route.source.decimals!,
        route.destination.decimals!
      );

      rates.push({
        source: route.source,
        destination: route.destination,
        amountIn: fromAmount,
        amountOut: toAmount,
        effectiveRate,
        quotedAt: new Date().toISOString(),
      });

      console.log(`[deBridge] Rate calculated: ${route.source.symbol} -> ${route.destination.symbol}, rate: ${effectiveRate}`);

    } catch (error) {
      console.error(`[deBridge] Failed to get rate for ${route.source.symbol} -> ${route.destination.symbol}:`, error instanceof Error ? error.message : String(error));
    }

    return rates;
  }

  async getLiquidityDepth(route: RouteType<DeBridgeAssetType>): Promise<LiquidityDepthType<DeBridgeAssetType>[]> {
    try {
      const decimals = route.source.decimals ?? 18;
      const unit = BigInt(10 ** decimals);
      const referenceAmount = (1000n * unit).toString();

      const sourceBlockchain = getBlockchainFromChainId(parseInt(route.source.chainId));
      const destBlockchain = getBlockchainFromChainId(parseInt(route.destination.chainId));
      
      if (!sourceBlockchain || !destBlockchain) {
        console.error(`[deBridge] Unable to resolve blockchains for liquidity depth`);
        return [];
      }

      const authorityAddress = getDefaultRecipient(sourceBlockchain);
      const recipient = getDefaultRecipient(destBlockchain);

      const quote = await this.client.fetchQuote({
        srcChainId: parseInt(route.source.chainId),
        srcChainTokenIn: route.source.address!,
        srcChainTokenInAmount: referenceAmount,
        dstChainId: parseInt(route.destination.chainId),
        dstChainTokenOut: route.destination.address!,
        dstChainTokenOutAmount: 'auto',
        dstChainTokenOutRecipient: recipient,
        dstChainOrderAuthorityAddress: authorityAddress,
        srcChainOrderAuthorityAddress: authorityAddress,
        prependOperatingExpenses: 'true'
      });

      const estimation = quote?.estimation;
      if (!estimation) {
        console.warn(`[deBridge] No estimation in quote response for liquidity`);
        return [];
      }

      const srcToken = estimation.srcChainTokenIn;
      const dstToken = estimation.dstChainTokenOut;

      const srcAmount = srcToken?.amount ?? referenceAmount;
      const recommendedDest = dstToken?.recommendedAmount ?? dstToken?.amount;
      const maxDest = dstToken?.maxTheoreticalAmount ?? recommendedDest;

      if (!srcAmount || !recommendedDest) {
        console.warn(`[deBridge] Missing amount data in quote for liquidity`);
        return [];
      }

      let maxSource = srcAmount;
      if (maxDest && recommendedDest !== '0') {
        try {
          const srcBig = BigInt(srcAmount);
          const recommendedBig = BigInt(recommendedDest);
          const maxBig = BigInt(maxDest);
          if (recommendedBig > 0n) {
            maxSource = ((srcBig * maxBig) / recommendedBig).toString();
          }
        } catch (error) {
          console.warn('[deBridge] Failed to compute max source for liquidity:', error);
        }
      }

      console.log(`[deBridge] Liquidity depth - 50bps: ${srcAmount}, 100bps: ${maxSource}`);

      return [{
        route,
        thresholds: [
          {
            maxAmountIn: srcAmount,
            slippageBps: 50,
          },
          {
            maxAmountIn: maxSource,
            slippageBps: 100,
          }
        ],
        measuredAt: new Date().toISOString(),
      }];

    } catch (error) {
      console.error(`[deBridge] Failed to fetch liquidity for ${route.source.symbol} -> ${route.destination.symbol}:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }
}
