import type {
  AssetType,
  LiquidityDepthType,
  RateType,
} from "@data-provider/shared-contract";
import { PluginClient } from "@data-provider/shared-contract";
import type { DuneClient } from "@duneanalytics/client-sdk";
import { Effect } from "every-plugin/effect";
import { ORPCError, type ContractRouterClient } from "every-plugin/orpc";
import type { contract as AssetEnrichmentContract } from "@data-provider/asset-enrichment/src/contract";
import type {
  AggregatedVolumeResultType,
  DailyVolumeType,
  DataType,
  EnrichedRateType,
  ProviderIdentifier,
  ProviderInfoType,
  TimePeriod,
} from "./contract";
import { aggregateListedAssets, buildAssetSupportIndex } from "./services/assets";
import { aggregateLiquidity } from "./services/liquidity";
import { PROVIDERS_LIST } from "./services/providers";
import { aggregateRates } from "./services/rates";
import { RedisService } from "./services/redis";
import { aggregateVolumes, getVolumes } from "./services/volumes";

export class DataAggregatorService {
  private dune: DuneClient;
  private providers: Partial<Record<ProviderIdentifier, PluginClient>>;
  private redis?: RedisService;
  private assetEnrichmentClient: ContractRouterClient<typeof AssetEnrichmentContract>;

  constructor(
    dune: DuneClient,
    providers: Partial<Record<ProviderIdentifier, PluginClient>>,
    assetEnrichmentClient: ContractRouterClient<typeof AssetEnrichmentContract>,
    redis?: RedisService
  ) {
    this.dune = dune;
    this.providers = providers;
    this.assetEnrichmentClient = assetEnrichmentClient;
    this.redis = redis;
  }

  private async enrichAsset(asset: AssetType): Promise<AssetType> {
    const id = asset.assetId;

    if (id && id.startsWith("1cs_v1:")) {
      try {
        return await this.assetEnrichmentClient.fromCanonicalId({ assetId: id });
      } catch (error: any) {
        const errorMsg = error?.message ?? String(error);
        console.warn(`[Aggregator] Failed to enrich asset from ID ${id}: ${errorMsg}`);
        return asset;
      }
    }

    const descriptor = {
      blockchain: asset.blockchain,
      chainId: asset.chainId,
      namespace: asset.namespace,
      reference: asset.reference,
      symbol: asset.symbol,
      decimals: asset.decimals,
    };

    try {
      return await this.assetEnrichmentClient.enrich(descriptor);
    } catch (error: any) {
      const errorMsg = error?.message ?? String(error);
      console.warn(`[Aggregator] Failed to enrich asset ${asset.symbol ?? asset.assetId}: ${errorMsg}`);
      return asset;
    }
  }

  private async enrichAssets(assets: AssetType[]): Promise<AssetType[]> {
    const results: AssetType[] = [];
    for (const a of assets) {
      const canonical = await this.enrichAsset(a);
      results.push(canonical);
    }
    return results;
  }

  getProviders(): ProviderInfoType[] {
    return PROVIDERS_LIST;
  }

  async rebuildAssetsCache(targetProviders?: ProviderIdentifier[]): Promise<void> {
    const ENRICHED_ASSETS_CACHE_TTL = 30 * 24 * 60 * 60;
    const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
    const providersToRebuild = targetProviders?.filter(p => availableProviders.includes(p)) ?? availableProviders;

    console.log(`[Aggregator] Rebuilding enriched assets cache for ${providersToRebuild.length} providers...`);

    const result = await aggregateListedAssets(this.providers, providersToRebuild);

    for (const provider of result.providers) {
      const assets = result.data[provider] ?? [];
      console.log(`[Aggregator] Enriching ${assets.length} assets for ${provider}...`);

      const enrichedAssets = await this.enrichAssets(assets);

      if (this.redis) {
        const enrichedCacheKey = `enriched-assets:${provider}`;
        try {
          await Effect.runPromise(
            this.redis.set<AssetType[]>(enrichedCacheKey, enrichedAssets, ENRICHED_ASSETS_CACHE_TTL)
          );
          console.log(`[Aggregator] Cached ${enrichedAssets.length} enriched assets for ${provider} (TTL: 30 days)`);
        } catch (error) {
          console.error(`[Aggregator] Failed to cache enriched assets for ${provider}:`, error);
        }
      }
    }

    console.log("[Aggregator] Asset cache rebuild complete");
  }

  async getVolumes(input: {
    providers?: ProviderIdentifier[];
    startDate?: string;
    endDate?: string;
    route?: {
      source: AssetType;
      destination: AssetType;
    };
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Record<ProviderIdentifier, DailyVolumeType[]>;
    aggregateTotal: DailyVolumeType[];
    measuredAt: string;
  }> {
    try {
      const result = await Effect.runPromise(
        getVolumes(this.dune, input, this.redis)
      );
      return result;
    } catch (error) {
      console.error("Error fetching volume data:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to fetch volume data",
      });
    }
  }

  async getVolumesAggregated(input: {
    period: TimePeriod;
    providers?: ProviderIdentifier[];
    route?: {
      source: AssetType;
      destination: AssetType;
    };
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Record<ProviderIdentifier, AggregatedVolumeResultType>;
    measuredAt: string;
  }> {
    try {
      const rawVolumes = await Effect.runPromise(
        getVolumes(this.dune, { providers: input.providers, route: input.route }, this.redis)
      );

      const aggregatedData: Record<ProviderIdentifier, AggregatedVolumeResultType> = {} as Record<ProviderIdentifier, AggregatedVolumeResultType>;

      for (const provider of rawVolumes.providers) {
        const providerVolumes = rawVolumes.data[provider] || [];
        aggregatedData[provider] = aggregateVolumes(providerVolumes, input.period);
      }

      return {
        providers: rawVolumes.providers,
        data: aggregatedData,
        measuredAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching aggregated volume data:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to fetch aggregated volume data",
      });
    }
  }

  async getListedAssets(input: {
    providers?: ProviderIdentifier[];
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Record<ProviderIdentifier, AssetType[]>;
    aggregateTotal?: DailyVolumeType[];
    measuredAt: string;
  }> {
    const ENRICHED_ASSETS_CACHE_TTL = 30 * 24 * 60 * 60;
    const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
    const targetProviders = input.providers?.filter(p => availableProviders.includes(p)) ?? availableProviders;

    const canonicalData: Record<ProviderIdentifier, AssetType[]> = {} as any;
    const successfulProviders: ProviderIdentifier[] = [];
    const providersToEnrich: ProviderIdentifier[] = [];

    if (this.redis) {
      for (const providerId of targetProviders) {
        const enrichedCacheKey = `enriched-assets:${providerId}`;
        try {
          const cached = await Effect.runPromise(this.redis.get<AssetType[]>(enrichedCacheKey));
          if (cached) {
            canonicalData[providerId] = cached;
            successfulProviders.push(providerId);
            console.log(`[Aggregator] Using cached enriched assets for ${providerId}`);
          } else {
            providersToEnrich.push(providerId);
          }
        } catch (error) {
          console.warn(`[Aggregator] Enriched cache check failed for ${providerId}:`, error);
          providersToEnrich.push(providerId);
        }
      }
    } else {
      providersToEnrich.push(...targetProviders);
    }

    if (providersToEnrich.length > 0) {
      console.log(`[Aggregator] Cache miss for ${providersToEnrich.length} providers, recomputing...`);
      const result = await aggregateListedAssets(this.providers, providersToEnrich);

      for (const provider of result.providers) {
        const assets = result.data[provider] ?? [];
        const enrichedAssets = await this.enrichAssets(assets);
        canonicalData[provider] = enrichedAssets;
        successfulProviders.push(provider);

        if (this.redis) {
          const enrichedCacheKey = `enriched-assets:${provider}`;
          try {
            await Effect.runPromise(
              this.redis.set<AssetType[]>(enrichedCacheKey, enrichedAssets, ENRICHED_ASSETS_CACHE_TTL)
            );
            console.log(`[Aggregator] Cached ${enrichedAssets.length} enriched assets for ${provider} (TTL: 30 days)`);
          } catch (error) {
            console.error(`[Aggregator] Failed to cache enriched assets for ${provider}:`, error);
          }
        }
      }
    }

    return {
      providers: successfulProviders,
      data: canonicalData,
      measuredAt: new Date().toISOString(),
    };
  }



  async getRates(input: {
    route: {
      source: AssetType;
      destination: AssetType;
    };
    amount: string;
    providers?: ProviderIdentifier[];
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Partial<Record<ProviderIdentifier, EnrichedRateType[]>>;
    measuredAt: string;
  }> {
    return await Effect.runPromise(
      Effect.gen(this, function* () {
        const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
        const targetProviders = input.providers?.filter(p => availableProviders.includes(p)) ?? availableProviders;

        const [enrichedSource, enrichedDest] = yield* Effect.all([
          Effect.tryPromise(() => this.enrichAsset(input.route.source)),
          Effect.tryPromise(() => this.enrichAsset(input.route.destination))
        ]);

        const canonicalRoute = { source: enrichedSource, destination: enrichedDest };

        const result = yield* Effect.tryPromise(() => 
          aggregateRates(this.providers, {
            route: canonicalRoute,
            amount: input.amount,
            targetProviders
          })
        );

        const uniqueAssetIds = new Set<string>();
        for (const rates of Object.values(result.data)) {
          for (const rate of rates) {
            uniqueAssetIds.add(rate.source.assetId);
            uniqueAssetIds.add(rate.destination.assetId);
          }
        }

        const priceResults = yield* Effect.forEach(
          Array.from(uniqueAssetIds),
          (assetId) => Effect.tryPromise({
            try: async () => {
              const priceData = await this.assetEnrichmentClient.getPrice({ assetId });
              return priceData.price !== null ? { assetId, price: priceData.price } : null;
            },
            catch: () => null
          }).pipe(Effect.option),
          { concurrency: "unbounded" }
        );

        const priceMap = new Map<string, number>();
        for (const priceResult of priceResults) {
          if (priceResult._tag === 'Some' && priceResult.value) {
            priceMap.set(priceResult.value.assetId, priceResult.value.price);
          }
        }

        const enrichedData: Partial<Record<ProviderIdentifier, EnrichedRateType[]>> = {};
        for (const [providerId, rates] of Object.entries(result.data)) {
          enrichedData[providerId as ProviderIdentifier] = rates.map((rate: RateType) => {
            const sourcePrice = priceMap.get(rate.source.assetId);
            const destPrice = priceMap.get(rate.destination.assetId);

            let amountInUsd: number | undefined;
            let amountOutUsd: number | undefined;
            let totalFeesUsd: number | undefined;

            if (sourcePrice && rate.amountIn) {
              const amountInFloat = parseFloat(rate.amountIn) / Math.pow(10, rate.source.decimals);
              amountInUsd = amountInFloat * sourcePrice;
            }

            if (destPrice && rate.amountOut) {
              const amountOutFloat = parseFloat(rate.amountOut) / Math.pow(10, rate.destination.decimals);
              amountOutUsd = amountOutFloat * destPrice;
            }

            if (amountInUsd !== undefined && amountOutUsd !== undefined) {
              totalFeesUsd = amountInUsd - amountOutUsd;
            }

            return {
              ...rate,
              amountInUsd,
              amountOutUsd,
              totalFeesUsd,
            };
          });
        }

        return { ...result, data: enrichedData, measuredAt: new Date().toISOString() };
      })
    );
  }

  async getLiquidity(input: {
    route: {
      source: AssetType;
      destination: AssetType;
    };
    providers?: ProviderIdentifier[];
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Record<ProviderIdentifier, LiquidityDepthType[]>;
    measuredAt: string;
  }> {
    return await Effect.runPromise(
      Effect.gen(this, function* () {
        const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
        const targetProviders = input.providers?.filter(p => availableProviders.includes(p)) ?? availableProviders;

        const [enrichedSource, enrichedDest] = yield* Effect.all([
          Effect.tryPromise(() => this.enrichAsset(input.route.source)),
          Effect.tryPromise(() => this.enrichAsset(input.route.destination))
        ]);

        const canonicalRoute = { source: enrichedSource, destination: enrichedDest };

        const result = yield* Effect.tryPromise(() =>
          aggregateLiquidity(this.providers, {
            route: canonicalRoute,
            targetProviders
          })
        );

        const sourcePrice = yield* Effect.tryPromise({
          try: async () => {
            const priceData = await this.assetEnrichmentClient.getPrice({ 
              assetId: enrichedSource.assetId 
            });
            return priceData.price;
          },
          catch: () => null
        }).pipe(Effect.option);

        const enrichedData: Record<ProviderIdentifier, LiquidityDepthType[]> = {} as Record<ProviderIdentifier, LiquidityDepthType[]>;
        
        for (const [providerId, liquidityDepths] of Object.entries(result.data)) {
          enrichedData[providerId as ProviderIdentifier] = liquidityDepths.map((depth: LiquidityDepthType) => {
            const enrichedThresholds = depth.thresholds.map(threshold => {
              let maxAmountInUsd: number | undefined;
              
              if (sourcePrice._tag === 'Some' && sourcePrice.value !== null) {
                const amountInFloat = parseFloat(threshold.maxAmountIn) / Math.pow(10, enrichedSource.decimals);
                maxAmountInUsd = amountInFloat * sourcePrice.value;
              }
              
              return {
                ...threshold,
                maxAmountInUsd,
              };
            });
            
            return {
              ...depth,
              thresholds: enrichedThresholds,
            };
          });
        }

        return { ...result, data: enrichedData, measuredAt: new Date().toISOString() };
      })
    );
  }
}
