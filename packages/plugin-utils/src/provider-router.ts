import { Effect } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import type { DataProviderService } from "./service";
import { os } from "every-plugin/orpc";

/**
 * Creates a typed oRPC middleware that transforms NEAR Intents route to provider format.
 * Transforms individual source/destination assets of a single route.
 */
export function createTransformRouteMiddleware<TInputAsset, TOutputAsset>(
  transformAsset: (asset: TInputAsset) => Promise<TOutputAsset>
) {
  return os.middleware(async ({ context, next }, input: {
    route?: { source: TInputAsset; destination: TInputAsset };
  }) => {
    // Transform route by transforming individual assets
    let transformedRoute: { source: TOutputAsset; destination: TOutputAsset } | undefined;

    if (input.route) {
      const [source, destination] = await Promise.all([
        transformAsset(input.route.source),
        transformAsset(input.route.destination)
      ]);
      transformedRoute = { source, destination };
    }

    // Add transformed route to context (middleware updates context, not input)
    return next({
      context: {
        ...context,
        route: transformedRoute
      }
    });
  });
}


/**
 * Creates a standardized router implementation for data provider plugins.
 * Handles all the boilerplate of transforming between provider-specific and canonical formats.
 * 
 * @template TProviderAsset - The provider-specific asset type
 * @param service - Service instance that implements data fetching and transformations
 * @param builder - Router builder from every-plugin (inferred from contract)
 * @returns Standard route handlers (getVolumes, getListedAssets, getRates, getLiquidity, ping)
 */
export function createProviderRouter<TProviderAsset>(
  service: DataProviderService<TProviderAsset>,
  builder: any
) {
  // Create typed middleware using service transformation method
  const transformRouteMiddleware = createTransformRouteMiddleware<
    AssetType,
    TProviderAsset
  >((asset: AssetType) => service.transformAssetToProvider(asset));

  return {
    getVolumes: builder.getVolumes.handler(async ({ input }) => {
      const volumes = await service.getVolumes(input.includeWindows || ["24h"]);
      return { volumes };
    }),

    getListedAssets: builder.getListedAssets.handler(async () => {
      const providerAssets = await service.getListedAssets();

      const convertAsset = (asset: TProviderAsset) =>
        Effect.tryPromise({
          try: () => service.transformAssetFromProvider(asset),
          catch: (error) => ({
            _tag: 'AssetConversionError' as const,
            asset,
            error: error instanceof Error ? error.message : String(error)
          })
        }).pipe(
          Effect.tapError(err =>
            Effect.logWarning(`Failed to convert asset: ${err.error}`)
          ),
          Effect.option
        );

      const assetConverter = Effect.forEach(
        providerAssets,
        convertAsset,
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.map(results => results.filter((opt): opt is typeof opt & { _tag: 'Some' } => opt._tag === 'Some').map(opt => opt.value))
      );

      const assets = await Effect.runPromise(assetConverter);

      return {
        assets,
        measuredAt: new Date().toISOString()
      };
    }),

    getRates: builder.getRates.use(transformRouteMiddleware).handler(async ({ input, context }) => {
      if (!context.route) {
        return { rates: [] };
      }

      const providerRates = await service.getRates(context.route, input.amount);

      const convertRate = (rate: typeof providerRates[0]) =>
        Effect.all([
          Effect.tryPromise(() => service.transformAssetFromProvider(rate.source)),
          Effect.tryPromise(() => service.transformAssetFromProvider(rate.destination))
        ]).pipe(
          Effect.map(([source, destination]) => ({
            source,
            destination,
            amountIn: rate.amountIn,
            amountOut: rate.amountOut,
            effectiveRate: rate.effectiveRate,
            quotedAt: rate.quotedAt
          })),
          Effect.tapError(err =>
            Effect.logWarning('Failed to convert rate', { error: String(err) })
          ),
          Effect.option
        );

      const rateConverter = Effect.forEach(
        providerRates,
        convertRate,
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.map(results => results.filter((opt): opt is typeof opt & { _tag: 'Some' } => opt._tag === 'Some').map(opt => opt.value))
      );

      const rates = await Effect.runPromise(rateConverter);
      return { rates };
    }),

    getLiquidity: builder.getLiquidity.use(transformRouteMiddleware).handler(async ({ input, context }) => {
      if (!context.route) {
        return { liquidity: [] };
      }

      const providerLiquidity = await service.getLiquidityDepth(context.route);

      const convertLiquidity = (liquid: typeof providerLiquidity[0]) =>
        Effect.all([
          Effect.tryPromise(() => service.transformAssetFromProvider(liquid.route.source)),
          Effect.tryPromise(() => service.transformAssetFromProvider(liquid.route.destination))
        ]).pipe(
          Effect.map(([source, destination]) => ({
            route: { source, destination },
            thresholds: liquid.thresholds,
            measuredAt: liquid.measuredAt
          })),
          Effect.tapError(err =>
            Effect.logWarning('Failed to convert liquidity', { error: String(err) })
          ),
          Effect.option
        );

      const liquidityConverter = Effect.forEach(
        providerLiquidity,
        convertLiquidity,
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.map(results => results.filter((opt): opt is typeof opt & { _tag: 'Some' } => opt._tag === 'Some').map(opt => opt.value))
      );

      const liquidity = await Effect.runPromise(liquidityConverter);
      return { liquidity };
    }),

    ping: builder.ping.handler(async () => {
      return {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      };
    }),
  };
}
