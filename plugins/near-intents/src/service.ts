import { DataProviderService as BaseDataProviderService, calculateEffectiveRate, assetToCanonicalIdentity, canonicalToAsset, getChainNamespace } from "@data-provider/plugin-utils";
import type {
  AssetType, LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from "@data-provider/shared-contract";
import { QuoteRequest } from "@defuse-protocol/one-click-sdk-typescript";
import { IntentsAssetType, IntentsClient } from "./client";

export class IntentsService extends BaseDataProviderService<IntentsAssetType> {
  private canonicalToProvider = new Map<string, IntentsAssetType>();

  constructor(private readonly client: IntentsClient) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   * Simply converts the canonical asset (which now includes symbol/decimals) to provider format.
   */
async transformAssetToProvider(asset: AssetType): Promise<IntentsAssetType> {
    const identity = await assetToCanonicalIdentity(asset);
    const key = identity.assetId.toLowerCase();

    const existing = this.canonicalToProvider.get(key);
    if (existing) {
      return existing;
    }

    // Fallback: synthetic asset... hopefully the above works
    // but won't crash the pipeline
    return {
      blockchain: identity.blockchain,
      assetId: identity.assetId, // 1cs_v1
      symbol: asset.symbol,
      decimals: asset.decimals,
      contractAddress:
        identity.reference === "coin" ? undefined : identity.reference,
    };
  }

  /**
   * Transform provider-specific asset to canonical AssetType format.
   */
  async transformAssetFromProvider(
    asset: IntentsAssetType,
  ): Promise<AssetType> {
    try {
      let identity;

      if (asset.assetId.startsWith("1cs_v1:")) {
        // Already canonical: just parse
        identity = await assetToCanonicalIdentity({ assetId: asset.assetId });
      } else {
        // Derive namespace/reference from chain + contractAddress
        const { namespace, reference } = getChainNamespace(
          asset.blockchain,
          asset.contractAddress,
        );

        identity = await assetToCanonicalIdentity({
          blockchain: asset.blockchain,
          namespace,
          reference,
        } as any);
      }

      const canonical = canonicalToAsset(identity, {
        symbol: asset.symbol,
        decimals: asset.decimals,
      });

      // Cache mapping for reverse lookup (canonical → provider)
      this.canonicalToProvider.set(canonical.assetId.toLowerCase(), asset);

      return canonical;
    } catch (error) {
      console.warn(
        `[NEAR Intents] Failed to convert asset ${asset.symbol} (blockchain: ${asset.blockchain}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetch volume metrics using DefiLlama DEX volume data.
   * Supports cumulative window in addition to standard time periods.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    try {
      const summary = await this.client.fetchDexSummary();
      const measuredAt = new Date().toISOString();
      const volumes: { window: TimeWindow; volumeUsd: number; measuredAt: string }[] = [];

      for (const window of windows) {
        let volumeUsd = 0;

        switch (window) {
          case "24h":
            volumeUsd = summary.total24h ?? 0;
            break;
          case "7d":
            volumeUsd = summary.total7d ?? 0;
            break;
          case "30d":
            volumeUsd = summary.total30d ?? 0;
            break;
          case "all":
            volumeUsd = summary.totalAllTime ?? 0;
            break;
        }

        volumes.push({ window, volumeUsd, measuredAt });

        console.log(`[NEAR Intents] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }

      return volumes;
    } catch (error) {
      console.error("[NEAR Intents] Failed to fetch DEX volume from DefiLlama:", error);
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString(),
      }));
    }
  }

  /**
   * Fetch list of assets supported by NEAR Intents using 1Click API.
   */
  async getListedAssets(): Promise<IntentsAssetType[]> {
    try {
      const tokens = await this.client.fetchTokens();

      // Map 1Click TokenResponse to IntentsAssetType
      // Deduplicate by (blockchain, assetId) to avoid duplicates
      const assetMap = new Map<string, IntentsAssetType>();

      for (const token of tokens) {
        const key = `${token.blockchain}:${token.assetId}`;

        if (!assetMap.has(key)) {
          assetMap.set(key, {
            blockchain: token.blockchain,
            assetId: token.assetId,
            symbol: token.symbol,
            decimals: token.decimals,
            contractAddress: token.contractAddress,
            price: token.price,
            priceUpdatedAt: token.priceUpdatedAt
          });
        }
      }

      console.log(`[NEAR Intents] Deduplicated ${tokens.length} tokens from 1Click to ${assetMap.size} unique assets`);
      return Array.from(assetMap.values());

    } catch (error) {
      console.error("[NEAR Intents] Failed to fetch tokens from 1Click:", error);
      return [];
    }
  }

  /**
   * Fetch rate quotes for route/notional combinations using 1Click API.
   */
  async getRates(route: RouteType<IntentsAssetType>, notionals: string[]): Promise<RateType<IntentsAssetType>[]> {
    const rates: RateType<IntentsAssetType>[] = [];

    // Skip routes where source and destination are the same asset
    if (route.source.assetId === route.destination.assetId) {
      console.log(`[NEAR Intents] Skipping same-asset route: ${route.source.assetId}`);
      return rates;
    }

    for (const notional of notionals) {
      try {
        // Build quote request for dry-run mode
        const quoteRequest: QuoteRequest = {
          dry: true,
          swapType: QuoteRequest.swapType.EXACT_INPUT,
          slippageTolerance: 100, // 1%
          originAsset: route.source.assetId,
          depositType: QuoteRequest.depositType.INTENTS,
          destinationAsset: route.destination.assetId,
          amount: notional,
          refundTo: 'recipient.near', // dummy valid recipient
          refundType: QuoteRequest.refundType.INTENTS,
          recipient: 'recipient.near', // TODO: this needs to match the target chain
          recipientType: QuoteRequest.recipientType.INTENTS,
          deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        };

        const response = await this.client.fetchQuote(quoteRequest);

        // Extract quote data
        const quote = response.quote;
        const amountIn = quote.amountIn;
        const amountOut = quote.amountOut;

        const effectiveRate = calculateEffectiveRate(
          amountIn,
          amountOut,
          route.source.decimals,
          route.destination.decimals
        );

        rates.push({
          source: route.source,
          destination: route.destination,
          amountIn,
          amountOut,
          effectiveRate,
          quotedAt: response.timestamp || new Date().toISOString(),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[NEAR Intents] Failed to get rate for ${route.source.symbol} (${route.source.assetId}) -> ` +
          `${route.destination.symbol} (${route.destination.assetId}) with amount ${notional}: ${errorMessage}`
        );
        // Skip this notional but continue with others
      }
    }

    console.log(`[NEAR Intents] Successfully fetched ${rates.length} rates for route`);
    return rates;
  }

  /**
   * Fetch liquidity depth at 50bps and 100bps thresholds.
   * Estimates depth by requesting quotes at various notional sizes and measuring slippage.
   */
  async getLiquidityDepth(route: RouteType<IntentsAssetType>): Promise<LiquidityDepthType<IntentsAssetType>[]> {
    const liquidity: LiquidityDepthType<IntentsAssetType>[] = [];

    try {
      // Define candidate notionals to test for liquidity
      // Use a range similar to testNotionals but extended
      const candidateNotionals = [
        '100000000',      // $100 for 6-decimal tokens
        '1000000000',     // $1K
        '10000000000',    // $10K
        '100000000000',   // $100K
        '1000000000000',  // $1M
      ];

      // Get baseline rate from smallest notional
      const baselineAmount = candidateNotionals[0]!;
      const baselineResponse = await this.client.fetchQuote({
        dry: true,
        swapType: QuoteRequest.swapType.EXACT_INPUT,
        slippageTolerance: 100, // 1%
        originAsset: route.source.assetId,
        depositType: QuoteRequest.depositType.INTENTS,
        destinationAsset: route.destination.assetId,
        amount: baselineAmount,
        refundTo: 'recipient.near',
        refundType: QuoteRequest.refundType.INTENTS,
        recipient: 'recipient.near',
        recipientType: QuoteRequest.recipientType.INTENTS,
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      });

      const baselineRate = calculateEffectiveRate(
        baselineResponse.quote.amountIn,
        baselineResponse.quote.amountOut,
        route.source.decimals,
        route.destination.decimals
      );

      // Find max amounts at 50bps and 100bps slippage
      let maxAmount50bps: string | undefined;
      let maxAmount100bps: string | undefined;

      for (const notional of candidateNotionals) {
        try {
          const response = await this.client.fetchQuote({
            dry: true,
            swapType: QuoteRequest.swapType.EXACT_INPUT,
            slippageTolerance: 100, // 1%
            originAsset: route.source.assetId,
            depositType: QuoteRequest.depositType.INTENTS,
            destinationAsset: route.destination.assetId,
            amount: notional,
            refundTo: 'recipient.near',
            refundType: QuoteRequest.refundType.INTENTS,
            recipient: 'recipient.near',
            recipientType: QuoteRequest.recipientType.INTENTS,
            deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          });

          const currentRate = calculateEffectiveRate(
            response.quote.amountIn,
            response.quote.amountOut,
            route.source.decimals,
            route.destination.decimals
          );

          const slippageBps = Math.abs(currentRate / baselineRate - 1) * 10000;

          if (slippageBps <= 50 && (!maxAmount50bps || parseFloat(notional) > parseFloat(maxAmount50bps))) {
            maxAmount50bps = notional;
          }
          if (slippageBps <= 100 && (!maxAmount100bps || parseFloat(notional) > parseFloat(maxAmount100bps))) {
            maxAmount100bps = notional;
          }
        } catch (error) {
          // Skip this notional size if quote fails
          console.error(`[NEAR Intents] Quote failed for liquidity test at amount ${notional}:`, error);
        }
      }

      // Build thresholds array - may be empty if no quotes succeeded
      const thresholds = [];
      if (maxAmount50bps) {
        thresholds.push({
          maxAmountIn: maxAmount50bps,
          slippageBps: 50,
        });
      }
      if (maxAmount100bps) {
        thresholds.push({
          maxAmountIn: maxAmount100bps,
          slippageBps: 100,
        });
      }

      liquidity.push({
        route,
        thresholds,
        measuredAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[NEAR Intents] Failed to fetch liquidity for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
      // Still add an entry with empty thresholds to maintain structure
      liquidity.push({
        route,
        thresholds: [],
        measuredAt: new Date().toISOString(),
      });
    }

    console.log(`[NEAR Intents] Successfully measured liquidity for route`);
    return liquidity;
  }
}
