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
  private isSyncInProgress: boolean = false;
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
    if (asset.assetId) {
      try {
        const enriched = await this.assetEnrichmentClient.fromCanonicalId({ assetId: asset.assetId });
        return enriched;
      } catch (error: any) {
        const errorMsg = error?.message ?? String(error);
        console.warn(`[Aggregator] Failed to enrich asset from ID ${asset.assetId}: ${errorMsg}`);
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
      const enriched = await this.assetEnrichmentClient.enrich(descriptor);
      return enriched;
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

  async startSync(datasets?: DataType[]): Promise<void> {
    if (this.isSyncInProgress) {
      throw new ORPCError("CONFLICT", {
        message: "Sync already in progress",
      });
    }

    this.isSyncInProgress = true;

    const self = this;
    const ENRICHED_ASSETS_CACHE_TTL = 30 * 24 * 60 * 60;

    const waitForEnrichmentSync = Effect.gen(function* () {
      const maxAttempts = 60;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = yield* Effect.tryPromise({
          try: () => self.assetEnrichmentClient.getSyncStatus(),
          catch: (error) => new Error(`Failed to get sync status: ${error}`),
        });

        if (status.status === "idle") {
          console.log("[Aggregator] Asset enrichment sync completed successfully");
          return;
        }

        if (status.status === "error") {
          console.error("[Aggregator] Asset enrichment sync failed:", status.errorMessage);
          return yield* Effect.fail(new Error(status.errorMessage || "Enrichment sync failed"));
        }

        console.log(`[Aggregator] Waiting for enrichment sync... (attempt ${attempt + 1}/${maxAttempts})`);
        yield* Effect.sleep("5 seconds");
      }

      console.warn("[Aggregator] Enrichment sync status check timed out");
      return yield* Effect.fail(new Error("Enrichment sync status check timed out"));
    });

    const populateEnrichedCache = Effect.gen(function* () {
      console.log("[Aggregator] Populating enriched assets cache...");
      const availableProviders = Object.keys(self.providers) as ProviderIdentifier[];

      const result = yield* Effect.tryPromise({
        try: () => aggregateListedAssets(self.providers, availableProviders),
        catch: (error) => new Error(`Failed to aggregate assets: ${error}`),
      });

      for (const provider of result.providers) {
        const assets = result.data[provider] ?? [];
        console.log(`[Aggregator] Enriching ${assets.length} assets for ${provider}...`);

        const enrichedAssets = yield* Effect.tryPromise({
          try: () => self.enrichAssets(assets),
          catch: (error) => new Error(`Failed to enrich assets for ${provider}: ${error}`),
        });

        if (self.redis) {
          const enrichedCacheKey = `enriched-assets:${provider}`;
          yield* self.redis
            .set<AssetType[]>(enrichedCacheKey, enrichedAssets, ENRICHED_ASSETS_CACHE_TTL)
            .pipe(
              Effect.tap(() =>
                Effect.sync(() =>
                  console.log(`[Aggregator] Cached ${enrichedAssets.length} enriched assets for ${provider} (TTL: 30 days)`)
                )
              ),
              Effect.catchAll((error) =>
                Effect.sync(() =>
                  console.error(`[Aggregator] Failed to cache enriched assets for ${provider}:`, error)
                ).pipe(Effect.as(undefined))
              )
            );
        }
      }

      console.log("[Aggregator] Asset sync complete");
    });

    const syncEffect = Effect.gen(function* () {
      if (!datasets || datasets.includes("assets")) {
        console.log("[Aggregator] Starting asset enrichment sync...");

        yield* Effect.tryPromise({
          try: () => self.assetEnrichmentClient.sync(),
          catch: (error) => new Error(`Failed to initiate enrichment sync: ${error}`),
        });

        console.log("[Aggregator] Asset enrichment sync initiated");

        yield* waitForEnrichmentSync.pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => console.warn("[Aggregator] Enrichment sync error:", error.message))
          )
        );

        yield* populateEnrichedCache;
      }
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => console.error("[Aggregator] Sync failed:", error))
      ),
      Effect.ensuring(
        Effect.sync(() => {
          self.isSyncInProgress = false;
        })
      )
    );

    Effect.runFork(syncEffect);
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

    if (providersToEnrich.length > 0 && this.redis) {
      this.startSync(["assets"]).catch((error) => {
        console.error("[Aggregator] Failed to trigger sync from cold cache:", error);
      });

      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Asset cache is warming up. Please try again in a moment.",
      });
    }

    if (providersToEnrich.length > 0 && !this.redis) {
      const result = await aggregateListedAssets(this.providers, providersToEnrich);

      for (const provider of result.providers) {
        const assets = result.data[provider] ?? [];
        const enrichedAssets = await this.enrichAssets(assets);
        canonicalData[provider] = enrichedAssets;
        successfulProviders.push(provider);
      }
    }

    return {
      providers: successfulProviders,
      data: canonicalData,
      measuredAt: new Date().toISOString(),
    };
  }



  async getRates(input: {
    routes: Array<{
      source: AssetType;
      destination: AssetType;
    }>;
    notionals: string[];
    providers?: ProviderIdentifier[];
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Partial<Record<ProviderIdentifier, EnrichedRateType[]>>;
    aggregateTotal?: DailyVolumeType[];
    measuredAt: string;
  }> {
    const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
    const targetProviders = input.providers?.filter(p => availableProviders.includes(p)) ?? availableProviders;

    const canonicalRoutes = await Promise.all(
      input.routes.map(async (r) => ({
        source: await this.enrichAsset(r.source),
        destination: await this.enrichAsset(r.destination),
      }))
    );

    const enrichedAssetsData = await this.getListedAssets({ providers: targetProviders });
    const assetSupportIndex = buildAssetSupportIndex(enrichedAssetsData.data);
    const result = await aggregateRates(
      this.providers,
      { ...input, routes: canonicalRoutes, targetProviders },
      assetSupportIndex
    );

    const uniqueAssetIds = new Set<string>();
    for (const route of canonicalRoutes) {
      uniqueAssetIds.add(route.source.assetId);
      uniqueAssetIds.add(route.destination.assetId);
    }

    const priceMap = new Map<string, number>();
    await Promise.all(
      Array.from(uniqueAssetIds).map(async (assetId) => {
        try {
          const priceData = await this.assetEnrichmentClient.getPrice({ assetId });
          if (priceData.price !== null) {
            priceMap.set(assetId, priceData.price);
          }
        } catch (error) {
          console.warn(`Failed to fetch price for ${assetId}:`, error);
        }
      })
    );

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
  }

  async getLiquidity(input: {
    routes: Array<{
      source: AssetType;
      destination: AssetType;
    }>;
    providers?: ProviderIdentifier[];
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Record<ProviderIdentifier, LiquidityDepthType[]>;
    aggregateTotal?: DailyVolumeType[];
    measuredAt: string;
  }> {
    const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
    const targetProviders = input.providers?.filter(p => availableProviders.includes(p)) ?? availableProviders;

    const canonicalRoutes = await Promise.all(
      input.routes.map(async (r) => ({
        source: await this.enrichAsset(r.source),
        destination: await this.enrichAsset(r.destination),
      }))
    );

    const enrichedAssetsData = await this.getListedAssets({ providers: targetProviders });
    const assetSupportIndex = buildAssetSupportIndex(enrichedAssetsData.data);
    const result = await aggregateLiquidity(
      this.providers,
      { ...input, routes: canonicalRoutes, targetProviders },
      assetSupportIndex
    );
    return { ...result, measuredAt: new Date().toISOString() };
  }
}
