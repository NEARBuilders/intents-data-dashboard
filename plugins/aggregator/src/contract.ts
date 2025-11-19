import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const ProviderIdentifierEnum = z.enum([
  "across", "axelar", "cashmere", "ccip", "celer", "chainflip",
  "circle_cctp", "debridge", "everclear", "gaszip", "hyperlane",
  "layerzero", "mayan", "meson", "near_intents", "oneinch", "orbiter", "relay",
  "squid_axelar", "stargate", "synapse", "wormhole", "socket_bungee",
  "lifi", "okx", "rango", "thorswap"
]);

export type ProviderIdentifier = z.infer<typeof ProviderIdentifierEnum>;

export const CategoryEnum = z.enum([
  "Intent-based Bridge", "GMP", "Clearing Protocol", "Pool-based Bridge",
  "Other Bridge", "Bridge Aggregator"
]);
export type Category = z.infer<typeof CategoryEnum>;

export const DataTypeEnum = z.enum(["volumes", "rates", "liquidity", "assets"]);
export type DataType = z.infer<typeof DataTypeEnum>;

export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const Asset = z.object({
  blockchain: z.string(),
  assetId: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0),
  contractAddress: z.string().optional(),
});
export type AssetType = z.infer<typeof Asset>;

export const ProviderInfo = z.object({
  id: ProviderIdentifierEnum,
  label: z.string().describe("Human-friendly display name, e.g., 'NEAR Intents'"),
  category: CategoryEnum,
  logoUrl: z.string().url().optional().describe("URL for the provider's logo"),
  supportedData: z
    .array(DataTypeEnum)
    .describe("List of data types this provider supports."),
});
export type ProviderInfoType = z.infer<typeof ProviderInfo>;

export const Rate = z.object({
  source: Asset,
  destination: Asset,
  amountIn: z.string(),
  amountOut: z.string(),
  effectiveRate: z.number(),
  totalFeesUsd: z.number().nullable(),
  quotedAt: z.iso.datetime(),
});
export type RateType = z.infer<typeof Rate>;

export const LiquidityDepthPoint = z.object({
  maxAmountIn: z.string(),
  slippageBps: z.number(),
});
export type LiquidityDepthPointType = z.infer<typeof LiquidityDepthPoint>;

export const LiquidityDepth = z.object({
  route: z.object({ source: Asset, destination: Asset }),
  thresholds: z.array(LiquidityDepthPoint),
  measuredAt: z.iso.datetime(),
});
export type LiquidityDepthType = z.infer<typeof LiquidityDepth>;

export const DailyVolume = z.object({
  date: IsoDate,
  volumeUsd: z.number(),
});
export type DailyVolumeType = z.infer<typeof DailyVolume>;

const createProviderDataSchema = <T extends z.ZodTypeAny>(dataType: T) =>
  z.object({
    providers: z.array(ProviderIdentifierEnum),
    data: z.record(z.string(), z.array(dataType)),
    measuredAt: z.iso.datetime(),
  });

export const VolumeData = createProviderDataSchema(DailyVolume);
export type VolumeDataType = z.infer<typeof VolumeData>;

export const RateData = createProviderDataSchema(Rate);
export type RateDataType = z.infer<typeof RateData>;

export const LiquidityData = createProviderDataSchema(LiquidityDepth);
export type LiquidityDataType = z.infer<typeof LiquidityData>;

export const ListedAssetsData = createProviderDataSchema(Asset);
export type ListedAssetsDataType = z.infer<typeof ListedAssetsData>;

export const contract = oc.router({
  getProviders: oc
    .route({
      method: "GET",
      path: "/providers",
      summary: "Providers",
      description: "Retrieve metadata for all supported bridge providers, including their categories and supported data types.",
    })
    .output(z.object({ providers: z.array(ProviderInfo) }))
    .errors({
      SERVICE_UNAVAILABLE: {
        message: "Service temporarily unavailable",
        status: 503,
      },
      INTERNAL_SERVER_ERROR: {
        message: "An unexpected error occurred",
        status: 500,
      },
    }),

  sync: oc
    .route({
      method: "POST",
      path: "/sync",
      summary: "Sync",
      description: "Trigger a background job to refresh cached data for specified datasets.",
    })
    .input(
      z.object({
        datasets: z
          .array(DataTypeEnum)
          .optional()
          .describe("List of data types to sync. If omitted, syncs all datasets."),
      })
    )
    .output(
      z.object({
        status: z.literal("sync_initiated"),
        timestamp: z.iso.datetime(),
      })
    )
    .errors({
      SERVICE_UNAVAILABLE: {
        message: "Service temporarily unavailable",
        status: 503,
      },
      CONFLICT: {
        message: "Operation cannot be performed due to conflict",
        status: 409,
      },
      INTERNAL_SERVER_ERROR: {
        message: "An unexpected error occurred",
        status: 500,
      },
    }),
  getVolumes: oc
    .route({
      method: "POST",
      path: "/volumes",
      summary: "Volumes",
      description: "Retrieve daily volume data aggregated by provider, with optional date range and route filters.",
    })
    .input(
      z.object({
        providers: z
          .array(ProviderIdentifierEnum)
          .optional()
          .default(["near_intents"])
          .describe("Filter by specific providers. Returns all providers if omitted."),

        startDate: IsoDate.optional().or(z.literal("")).transform(val => val || undefined).default("2025-11-01").describe("Start date for volume data (YYYY-MM-DD format)."),
        endDate: IsoDate.optional().or(z.literal("")).transform(val => val || undefined).describe("End date for volume data (YYYY-MM-DD format)."),
        route: z
          .object({ source: Asset, destination: Asset })
          .optional()
          .default(undefined)
          .describe("Filter volumes for a specific route."),
      })
    )
    .output(VolumeData)
    .errors({
      BAD_REQUEST: {
        message: "Invalid request parameters",
        status: 400,
      },
      SERVICE_UNAVAILABLE: {
        message: "Cache unavailable or service not ready",
        status: 503,
      },
      INTERNAL_SERVER_ERROR: {
        message: "An unexpected error occurred",
        status: 500,
      },
    }),
  getListedAssets: oc
    .route({
      method: "POST",
      path: "/assets",
      summary: "Assets",
      description: "Retrieve the list of supported assets for specified providers.",
    })
    .input(
      z.object({
        providers: z
          .array(ProviderIdentifierEnum)
          .optional()
          .describe("Filter by specific providers. Returns all providers if omitted."),
      })
    )
    .output(ListedAssetsData)
    .errors({
      SERVICE_UNAVAILABLE: {
        message: "Cache unavailable or service not ready",
        status: 503,
      },
      INTERNAL_SERVER_ERROR: {
        message: "An unexpected error occurred",
        status: 500,
      },
    }),
  getRates: oc
    .route({
      method: "POST",
      path: "/rates",
      summary: "Rates",
      description: "Get quoted exchange rates for specified routes and notional amounts across providers.",
    })
    .input(
      z.object({
        routes: z
          .array(z.object({ source: Asset, destination: Asset }))
          .describe("Array of routes to quote."),
        notionals: z
          .array(z.string())
          .describe("Array of input amounts (as strings to preserve precision)."),
        providers: z
          .array(ProviderIdentifierEnum)
          .optional()
          .describe("Filter by specific providers. Returns all providers if omitted."),
      })
    )
    .output(RateData)
    .errors({
      SERVICE_UNAVAILABLE: {
        message: "Cache unavailable or service not ready",
        status: 503,
      },
      INTERNAL_SERVER_ERROR: {
        message: "An unexpected error occurred",
        status: 500,
      },
    }),
  getLiquidity: oc
    .route({
      method: "POST",
      path: "/liquidity",
      summary: "Liquidity",
      description: "Retrieve liquidity depth information for specified routes, showing slippage at different order sizes.",
    })
    .input(
      z.object({
        routes: z
          .array(z.object({ source: Asset, destination: Asset }))
          .describe("Array of routes to check liquidity for."),
        providers: z
          .array(ProviderIdentifierEnum)
          .optional()
          .describe("Filter by specific providers. Returns all providers if omitted."),
      })
    )
    .output(LiquidityData)
    .errors({
      SERVICE_UNAVAILABLE: {
        message: "Cache unavailable or service not ready",
        status: 503,
      },
      INTERNAL_SERVER_ERROR: {
        message: "An unexpected error occurred",
        status: 500,
      },
    }),
});
