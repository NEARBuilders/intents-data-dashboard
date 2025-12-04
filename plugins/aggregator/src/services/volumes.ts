import type { DuneClient } from "@duneanalytics/client-sdk";
import { Effect } from "every-plugin/effect";
import type { DailyVolumeType, ProviderIdentifier } from "../contract";
import type { AssetType } from "@data-provider/shared-contract";
import { ProviderIdentifierEnum } from "../contract";
import type { CacheService } from "./cache";

export interface DuneVolumeRow {
  day: string;
  axelar: number;
  wormhole: number;
  hyperlane: number;
  layerzero: number;
  stargate: number;
  across: number;
  relay: number;
  ccip: number;
  meson: number;
  squid_axelar: number;
  orbiter: number;
  gaszip: number;
  synapse: number;
  celer: number;
  near_intents: number;
  cashmere: number;
  circle: number;
  lifi_aggregator_volume: number;
  socket_aggregator_volume: number;
  okx_aggregator_volume: number;
  rango_aggregator_volume: number;
  everclear_clearing_volume: number;
  oneinch: number;
  total_daily_volume: number;
  [key: string]: string | number;
}

export function parseDate(dayString: string): string {
  return dayString.split(' ')[0]!;
}

export function parseVolume(volume: number): number {
  // Return valid number or 0 for NaN
  return isNaN(volume) ? 0 : volume;
}

export function transformDuneVolumeData(rows: DuneVolumeRow[]): {
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, DailyVolumeType[]>;
  aggregateTotal: DailyVolumeType[];
  measuredAt: string;
} {
  const duneMapping: Record<string, ProviderIdentifier> = {
    axelar: "axelar",
    wormhole: "wormhole",
    hyperlane: "hyperlane",
    layerzero: "layerzero",
    stargate: "stargate",
    across: "across",
    relay: "relay",
    ccip: "ccip",
    meson: "meson",
    squid_axelar: "squid_axelar",
    orbiter: "orbiter",
    gaszip: "gaszip",
    synapse: "synapse",
    celer: "celer",
    near_intents: "near_intents",
    cashmere: "cashmere",
    circle: "circle_cctp",
    lifi_aggregator_volume: "lifi",
    socket_aggregator_volume: "socket_bungee",
    okx_aggregator_volume: "okx",
    rango_aggregator_volume: "rango",
    everclear_clearing_volume: "everclear",
    oneinch: "oneinch",
  };

  const allProviders = ProviderIdentifierEnum.options as ProviderIdentifier[];


  const processedData: Record<ProviderIdentifier, DailyVolumeType[]> = {} as Record<ProviderIdentifier, DailyVolumeType[]>;
  for (const provider of allProviders) {
    processedData[provider] = [];
  }

  const aggregateTotal: DailyVolumeType[] = [];

  for (const row of rows) {
    const date = parseDate(row.day);
    const totalVolume = parseVolume(row.total_daily_volume);

    aggregateTotal.push({
      date,
      volumeUsd: totalVolume,
    });

    for (const [duneKey, providerId] of Object.entries(duneMapping)) {
      const volume = (row[duneKey as keyof DuneVolumeRow] ?? 0) as number;
      const volumeNum = parseVolume(volume);

      processedData[providerId].push({
        date,
        volumeUsd: volumeNum,
      });
    }
  }

  // Only include providers that have actual data (non-empty arrays)
  const providersWithData = Object.keys(processedData).filter(
    p => processedData[p as ProviderIdentifier]!.length > 0
  ) as ProviderIdentifier[];

  // Sort data for providers that have it
  for (const providerId of providersWithData) {
    processedData[providerId as ProviderIdentifier]!.sort((a, b) => a.date.localeCompare(b.date));
  }

  aggregateTotal.sort((a, b) => a.date.localeCompare(b.date));

  // Create final data object only containing providers with data
  const finalData = Object.fromEntries(
    providersWithData.map(p => [p, processedData[p as ProviderIdentifier]!])
  ) as Record<ProviderIdentifier, DailyVolumeType[]>;

  return {
    providers: providersWithData,
    data: finalData,
    aggregateTotal,
    measuredAt: new Date().toISOString(),
  };
}

export function filterVolumeData(
  rawData: {
    providers: ProviderIdentifier[];
    data: Record<ProviderIdentifier, DailyVolumeType[]>;
    aggregateTotal: DailyVolumeType[];
    measuredAt: string;
  },
  filters: {
    providers?: ProviderIdentifier[];
    startDate?: string;
    endDate?: string;
    route?: {
      source: AssetType;
      destination: AssetType;
    };
  }
): {
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, DailyVolumeType[]>;
  aggregateTotal: DailyVolumeType[];
  measuredAt: string;
} {
  if (filters.route) {
    throw new Error("Route filtering is not supported for aggregated volume data");
  }

  let filteredProviders: ProviderIdentifier[] = filters.providers || rawData.providers;

  if (filters.providers) {
    filteredProviders = filters.providers.filter(provider => rawData.providers.includes(provider));
  }

  const filteredData: Partial<Record<ProviderIdentifier, DailyVolumeType[]>> = {};
  for (const provider of filteredProviders) {
    if (filters.startDate || filters.endDate) {
      filteredData[provider] = rawData.data[provider]?.filter(item =>
        (!filters.startDate || item.date >= filters.startDate) &&
        (!filters.endDate || item.date <= filters.endDate)
      ) || [];
    } else {
      filteredData[provider] = rawData.data[provider] || [];
    }
  }

  return {
    providers: filteredProviders,
    data: filteredData as Record<ProviderIdentifier, DailyVolumeType[]>,
    aggregateTotal: rawData.aggregateTotal.filter(item =>
      (!filters.startDate || item.date >= filters.startDate) &&
      (!filters.endDate || item.date <= filters.endDate)
    ),
    measuredAt: rawData.measuredAt,
  };
}

export interface VolumeInput {
  providers?: ProviderIdentifier[];
  startDate?: string;
  endDate?: string;
  route?: {
    source: AssetType;
    destination: AssetType;
  };
}

export interface VolumeResult {
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, DailyVolumeType[]>;
  aggregateTotal: DailyVolumeType[];
  measuredAt: string;
}

export function getVolumes(
  duneClient: DuneClient,
  input: VolumeInput,
  cacheService?: CacheService
): Effect.Effect<VolumeResult, Error> {
  return Effect.gen(function* () {
    const cacheKey = `volumes:raw:${JSON.stringify(input)}`;

    if (cacheService) {
      const cached = yield* cacheService.get<VolumeResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const queryResult = yield* Effect.tryPromise({
      try: () => duneClient.getLatestResult({ queryId: 5487957 }),
      catch: (error) => new Error(`Failed to fetch Dune data: ${error}`)
    });

    const rawData = queryResult.result?.rows || [];
    const transformedData = transformDuneVolumeData(rawData as DuneVolumeRow[]);
    const filteredData = filterVolumeData(transformedData, input);

    if (cacheService) {
      yield* cacheService.set(cacheKey, filteredData, 86400);
    }

    return filteredData;
  });
}

interface AggregatedDataPoint {
  date: string;
  volumeUsd: number;
  cumulativeVolume: number;
}

interface AggregatedVolumeResult {
  totalVolume: number;
  dataPoints: AggregatedDataPoint[];
}

type TimePeriod = "7d" | "30d" | "90d" | "all";
type Granularity = "daily" | "weekly" | "monthly";

function getDaysForPeriod(period: TimePeriod): number | null {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "all": return null;
  }
}

function getGranularityForPeriod(period: TimePeriod): Granularity {
  switch (period) {
    case "7d": return "daily";
    case "30d": return "daily";
    case "90d": return "weekly";
    case "all": return "monthly";
  }
}

function aggregateByGranularity(
  dailyVolumes: DailyVolumeType[],
  granularity: Granularity
): DailyVolumeType[] {
  if (granularity === "daily") {
    return dailyVolumes;
  }

  const aggregated: Map<string, number> = new Map();

  for (const volume of dailyVolumes) {
    const date = new Date(volume.date);
    let key: string;

    if (granularity === "weekly") {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      key = startOfWeek.toISOString().split('T')[0]!;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }

    const current = aggregated.get(key) || 0;
    aggregated.set(key, current + volume.volumeUsd);
  }

  return Array.from(aggregated.entries())
    .map(([date, volumeUsd]) => ({ date, volumeUsd }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateVolumes(
  volumeData: DailyVolumeType[],
  period: TimePeriod
): AggregatedVolumeResult {
  const days = getDaysForPeriod(period);
  const granularity = getGranularityForPeriod(period);

  let filteredData = volumeData;
  if (days !== null) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0]!;
    filteredData = volumeData.filter(v => v.date >= cutoffStr);
  }

  const aggregatedData = aggregateByGranularity(filteredData, granularity);

  let cumulativeVolume = 0;
  const dataPoints: AggregatedDataPoint[] = aggregatedData.map(point => {
    cumulativeVolume += point.volumeUsd;
    return {
      date: point.date,
      volumeUsd: point.volumeUsd,
      cumulativeVolume,
    };
  });

  const totalVolume = dataPoints.length > 0
    ? (dataPoints[dataPoints.length - 1]?.cumulativeVolume ?? 0)
    : 0;

  return {
    totalVolume,
    dataPoints,
  };
}
