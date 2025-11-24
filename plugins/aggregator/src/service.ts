import type {
  AssetType,
  LiquidityDepthType,
  RateType,
} from "@data-provider/shared-contract";
import { PluginClient } from "@data-provider/shared-contract";
import type { DuneClient } from "@duneanalytics/client-sdk";
import { Effect } from "every-plugin/effect";
import { ORPCError, type ContractRouterClient } from "every-plugin/orpc";
import type { contract as CanonicalAssetContract } from "@data-provider/asset-enrichment/src/contract";
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
  private canonicalAsset: ContractRouterClient<typeof CanonicalAssetContract>;

  constructor(
    dune: DuneClient,
    providers: Partial<Record<ProviderIdentifier, PluginClient>>,
    canonicalAsset: ContractRouterClient<typeof CanonicalAssetContract>,
    redis?: RedisService
  ) {
    this.dune = dune;
    this.providers = providers;
    this.canonicalAsset = canonicalAsset;
    this.redis = redis;
  }

  private async canonicalizeAsset(asset: AssetType): Promise<AssetType> {
    if (asset.assetId?.startsWith("1cs_v1:")) {
      try {
        const canonical = await this.canonicalAsset.fromCanonicalId({ assetId: asset.assetId });
        return canonical;
      } catch (error: any) {
        const errorMsg = error?.message ?? String(error);
        console.warn(`[Aggregator] Failed to canonicalize asset from ID ${asset.assetId}: ${errorMsg}`);
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
      const canonical = await this.canonicalAsset.normalize(descriptor);
      return canonical;
    } catch (error: any) {
      const errorMsg = error?.message ?? String(error);
      console.warn(`[Aggregator] Failed to normalize asset ${asset.symbol ?? asset.assetId}: ${errorMsg}`);
      return asset;
    }
  }

  private async canonicalizeAssets(assets: AssetType[]): Promise<AssetType[]> {
    const results: AssetType[] = [];
    for (const a of assets) {
      const canonical = await this.canonicalizeAsset(a);
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

    setTimeout(() => {
      this.isSyncInProgress = false;
    }, 1000);
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
    const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
    const targetProviders = input.providers?.filter(p => availableProviders.includes(p)) ?? availableProviders;

    const result = await aggregateListedAssets(this.providers, targetProviders, this.redis);

    const canonicalData: Record<ProviderIdentifier, AssetType[]> = {} as any;
    for (const provider of result.providers) {
      const assets = result.data[provider] ?? [];
      canonicalData[provider] = await this.canonicalizeAssets(assets);
    }

    return {
      providers: result.providers,
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
        source: await this.canonicalizeAsset(r.source),
        destination: await this.canonicalizeAsset(r.destination),
      }))
    );

    const assetSupportIndex = await buildAssetSupportIndex(this.providers, targetProviders);
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
          const priceData = await this.canonicalAsset.getPrice({ assetId });
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
        source: await this.canonicalizeAsset(r.source),
        destination: await this.canonicalizeAsset(r.destination),
      }))
    );

    const assetSupportIndex = await buildAssetSupportIndex(this.providers, targetProviders);
    const result = await aggregateLiquidity(
      this.providers,
      { ...input, routes: canonicalRoutes, targetProviders },
      assetSupportIndex
    );
    return { ...result, measuredAt: new Date().toISOString() };
  }
}
