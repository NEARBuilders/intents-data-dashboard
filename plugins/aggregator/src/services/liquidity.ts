import type { AssetType, LiquidityDepthType } from "@data-provider/shared-contract";
import type { ProviderIdentifier } from "../contract";
import { Effect } from "every-plugin/effect";

export async function aggregateLiquidity(
  providers: Partial<Record<ProviderIdentifier, any>>,
  input: {
    route: { source: AssetType; destination: AssetType };
    targetProviders: ProviderIdentifier[];
  }
): Promise<{
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, LiquidityDepthType[]>;
}> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const results = yield* Effect.forEach(
        input.targetProviders,
        (providerId) => Effect.gen(function* () {
          const client = providers[providerId];
          if (!client) return null;

          const result = yield* Effect.tryPromise({
            try: () => client.getLiquidity({ route: input.route }),
            catch: (error) => {
              console.error(`[Aggregator] Failed to get liquidity from ${providerId} for route ${input.route.source.symbol}->${input.route.destination.symbol}:`, error);
              return error;
            }
          }).pipe(Effect.option);

          if (result._tag === 'Some') {
            const liquidityResult = result.value as { liquidity: LiquidityDepthType[] };
            if (liquidityResult.liquidity.length > 0) {
              return { providerId, liquidity: liquidityResult.liquidity };
            }
          }
          return null;
        }),
        { concurrency: "unbounded" }
      );

      const data: Partial<Record<ProviderIdentifier, LiquidityDepthType[]>> = {};
      const successfulProviders: ProviderIdentifier[] = [];

      for (const result of results) {
        if (result) {
          const { providerId, liquidity } = result;
          data[providerId] = liquidity;
          successfulProviders.push(providerId);
        }
      }

      return {
        providers: successfulProviders,
        data: data as Record<ProviderIdentifier, LiquidityDepthType[]>,
      };
    })
  );
}
