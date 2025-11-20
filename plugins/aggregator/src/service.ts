import type { DuneClient } from "@duneanalytics/client-sdk";
import { ORPCError } from "every-plugin/orpc";
import type {
  AssetType,
  DailyVolumeType,
  DataType,
  LiquidityDepthType,
  ProviderIdentifier,
  ProviderInfoType,
  RateType,
} from "./contract";
import { type DuneVolumeRow, filterVolumeData, transformDuneVolumeData } from "./services/volumes";
import { buildAssetSupportIndex, aggregateListedAssets } from "./services/assets";
import { aggregateRates } from "./services/rates";
import { aggregateLiquidity } from "./services/liquidity";
import { PROVIDERS_LIST } from "./services/providers";

export class DataAggregatorService {
  private isSyncInProgress: boolean = false;
  private dune: DuneClient;
  private providers: Partial<Record<ProviderIdentifier, any>>;

  constructor(dune: DuneClient, providers: Partial<Record<ProviderIdentifier, any>>) {
    this.dune = dune;
    this.providers = providers;
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
      const queryResult = await this.dune.getLatestResult({ queryId: 5487957 });
      const rawData = queryResult.result?.rows || [];

      const transformedData = transformDuneVolumeData(rawData as DuneVolumeRow[]);
      const filteredData = filterVolumeData(transformedData, input);

      return filteredData;
    } catch (error) {
      console.error("Error fetching volume data:", error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to fetch volume data",
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

    const result = await aggregateListedAssets(this.providers, targetProviders);
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
