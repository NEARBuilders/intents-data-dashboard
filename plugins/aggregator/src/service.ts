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
import { type DuneVolumeRow, filterVolumeData, transformDuneVolumeData } from "./services/volume";

export class DataAggregatorService {
  private isSyncInProgress: boolean = false;
  private dune: DuneClient;

  constructor(dune: DuneClient) {
    this.dune = dune;
  }

  getProviders(): ProviderInfoType[] {
    return [
      {
        id: "across",
        label: "Across",
        category: "Intent-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "axelar",
        label: "Axelar",
        category: "GMP",
        supportedData: ["volumes"],
      },
      {
        id: "cashmere",
        label: "Cashmere",
        category: "Pool-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "ccip",
        label: "CCIP (Chainlink)",
        category: "GMP",
        supportedData: ["volumes"],
      },
      {
        id: "celer",
        label: "Celer cBridge",
        category: "Pool-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "chainflip",
        label: "Chainflip",
        category: "Intent-based Bridge",
        supportedData: [],
      },
      {
        id: "circle_cctp",
        label: "Circle CCTP",
        category: "Other Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "debridge",
        label: "deBridge (DLN)",
        category: "Intent-based Bridge",
        supportedData: [],
      },
      {
        id: "everclear",
        label: "Everclear",
        category: "Clearing Protocol",
        supportedData: ["volumes"],
      },
      {
        id: "gaszip",
        label: "GasZip",
        category: "Other Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "hyperlane",
        label: "Hyperlane",
        category: "GMP",
        supportedData: ["volumes"],
      },
      {
        id: "layerzero",
        label: "LayerZero",
        category: "GMP",
        supportedData: ["volumes"],
      },
      {
        id: "mayan",
        label: "Mayan",
        category: "Intent-based Bridge",
        supportedData: [],
      },
      {
        id: "meson",
        label: "Meson",
        category: "Pool-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "near_intents",
        label: "NEAR Intents",
        category: "Intent-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "oneinch",
        label: "1inch",
        category: "Bridge Aggregator",
        supportedData: ["volumes"],
      },
      {
        id: "orbiter",
        label: "Orbiter Finance",
        category: "Pool-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "relay",
        label: "Relay",
        category: "Intent-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "squid_axelar",
        label: "Squid (Axelar)",
        category: "Bridge Aggregator",
        supportedData: ["volumes"],
      },
      {
        id: "stargate",
        label: "Stargate",
        category: "Pool-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "synapse",
        label: "Synapse",
        category: "Pool-based Bridge",
        supportedData: ["volumes"],
      },
      {
        id: "wormhole",
        label: "Wormhole",
        category: "GMP",
        supportedData: ["volumes"],
      },
      {
        id: "socket_bungee",
        label: "Socket (Bungee)",
        category: "Bridge Aggregator",
        supportedData: ["volumes"],
      },
      {
        id: "lifi",
        label: "LiFi",
        category: "Bridge Aggregator",
        supportedData: ["volumes"],
      },
      {
        id: "okx",
        label: "OKX Bridge",
        category: "Bridge Aggregator",
        supportedData: ["volumes"],
      },
      {
        id: "rango",
        label: "Rango Exchange",
        category: "Bridge Aggregator",
        supportedData: ["volumes"],
      },
      {
        id: "thorswap",
        label: "THORSwap",
        category: "Bridge Aggregator",
        supportedData: [],
      },
    ];
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
    return {
      providers: [],
      data: {} as Record<ProviderIdentifier, AssetType[]>,
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
    data: Record<ProviderIdentifier, RateType[]>;
    aggregateTotal?: DailyVolumeType[];
    measuredAt: string;
  }> {
    return {
      providers: [],
      data: {} as Record<ProviderIdentifier, RateType[]>,
      measuredAt: new Date().toISOString(),
    };
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
    return {
      providers: [],
      data: {} as Record<ProviderIdentifier, LiquidityDepthType[]>,
      measuredAt: new Date().toISOString(),
    };
  }
}
