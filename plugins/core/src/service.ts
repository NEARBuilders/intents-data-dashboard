import { ORPCError } from "every-plugin/orpc";
import type {
  ProviderInfoType,
  ProviderIdentifier,
  DataType,
  DailyVolumeType,
  AssetType,
  RateType,
  LiquidityDepthType,
} from "./contract";

export class DataProviderService {
  private isSyncInProgress: boolean = false;

  getProviders(): ProviderInfoType[] {
    return [
      {
        id: "across",
        label: "Across",
        category: "Intent-based Bridge",
        supportedData: ["volumes", "rates", "assets"],
      },
      {
        id: "axelar",
        label: "Axelar",
        category: "GMP",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "cashmere",
        label: "Cashmere",
        category: "Pool-based Bridge",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "ccip",
        label: "CCIP (Chainlink)",
        category: "GMP",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "celer",
        label: "Celer cBridge",
        category: "Pool-based Bridge",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
      },
      {
        id: "chainflip",
        label: "Chainflip",
        category: "Intent-based Bridge",
        supportedData: ["volumes", "rates", "assets"],
      },
      {
        id: "circle_cctp",
        label: "Circle CCTP",
        category: "Other Bridge",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "debridge",
        label: "deBridge (DLN)",
        category: "Intent-based Bridge",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
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
        supportedData: ["volumes", "assets"],
      },
      {
        id: "hyperlane",
        label: "Hyperlane",
        category: "GMP",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "layerzero",
        label: "LayerZero",
        category: "GMP",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "mayan",
        label: "Mayan",
        category: "Intent-based Bridge",
        supportedData: ["volumes", "rates", "assets"],
      },
      {
        id: "meson",
        label: "Meson",
        category: "Pool-based Bridge",
        supportedData: ["volumes", "rates", "assets"],
      },
      {
        id: "near_intents",
        label: "NEAR Intents",
        category: "Intent-based Bridge",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
      },
      {
        id: "orbiter",
        label: "Orbiter Finance",
        category: "Pool-based Bridge",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "relay",
        label: "Relay",
        category: "Intent-based Bridge",
        supportedData: ["volumes", "rates", "assets"],
      },
      {
        id: "squid_axelar",
        label: "Squid (Axelar)",
        category: "Bridge Aggregator",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
      },
      {
        id: "stargate",
        label: "Stargate",
        category: "Pool-based Bridge",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
      },
      {
        id: "synapse",
        label: "Synapse",
        category: "Pool-based Bridge",
        supportedData: ["volumes", "rates", "assets"],
      },
      {
        id: "wormhole",
        label: "Wormhole",
        category: "GMP",
        supportedData: ["volumes", "assets"],
      },
      {
        id: "socket_bungee",
        label: "Socket (Bungee)",
        category: "Bridge Aggregator",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
      },
      {
        id: "lifi",
        label: "LiFi",
        category: "Bridge Aggregator",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
      },
      {
        id: "okx",
        label: "OKX Bridge",
        category: "Bridge Aggregator",
        supportedData: ["volumes", "rates", "assets"],
      },
      {
        id: "rango",
        label: "Rango Exchange",
        category: "Bridge Aggregator",
        supportedData: ["volumes", "rates", "liquidity", "assets"],
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
  }> {
    return {
      providers: [],
      data: {} as Record<ProviderIdentifier, DailyVolumeType[]>,
    };
  }

  async getListedAssets(input: {
    providers?: ProviderIdentifier[];
  }): Promise<{
    providers: ProviderIdentifier[];
    data: Record<ProviderIdentifier, AssetType[]>;
  }> {
    return {
      providers: [],
      data: {} as Record<ProviderIdentifier, AssetType[]>,
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
  }> {
    return {
      providers: [],
      data: {} as Record<ProviderIdentifier, RateType[]>,
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
  }> {
    return {
      providers: [],
      data: {} as Record<ProviderIdentifier, LiquidityDepthType[]>,
    };
  }
}
