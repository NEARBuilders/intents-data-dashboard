import type {
  AssetType,
  LiquidityDepthType,
  RateType,
} from "@data-provider/shared-contract";
import { PluginClient } from "@data-provider/shared-contract";
import type { DuneClient } from "@duneanalytics/client-sdk";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type {
  AggregatedVolumeResultType,
  DailyVolumeType,
  DataType,
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

  constructor(
    dune: DuneClient,
    providers: Partial<Record<ProviderIdentifier, PluginClient>>,
    redis?: RedisService
  ) {
    this.dune = dune;
    this.providers = providers;
    this.redis = redis;
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
    return { ...result, measuredAt: new Date().toISOString() };
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
    data: Record<ProviderIdentifier, RateType[]>;
    aggregateTotal?: DailyVolumeType[];
    measuredAt: string;
  }> {
    const availableProviders = Object.keys(this.providers) as ProviderIdentifier[];
    const targetProviders = input.providers?.filter(p => availableProviders.includes(p)) ?? availableProviders;

    const assetSupportIndex = await buildAssetSupportIndex(this.providers, targetProviders);
    const result = await aggregateRates(this.providers, { ...input, targetProviders }, assetSupportIndex);
    return { ...result, measuredAt: new Date().toISOString() };
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

    const assetSupportIndex = await buildAssetSupportIndex(this.providers, targetProviders);
    const result = await aggregateLiquidity(this.providers, { ...input, targetProviders }, assetSupportIndex);
    return { ...result, measuredAt: new Date().toISOString() };
  }
}
