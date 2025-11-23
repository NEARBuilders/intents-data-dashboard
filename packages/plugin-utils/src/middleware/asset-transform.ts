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
