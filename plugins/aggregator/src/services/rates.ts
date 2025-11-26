import type { AssetType, RateType } from "@data-provider/shared-contract";
import type { ProviderIdentifier } from "../contract";
import { Effect } from "every-plugin/effect";

export async function aggregateRates(
  providers: Partial<Record<ProviderIdentifier, any>>,
  input: {
    route: { source: AssetType; destination: AssetType };
    amount: string;
    targetProviders: ProviderIdentifier[];
  }
): Promise<{
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, RateType[]>;
}> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const results = yield* Effect.forEach(
        input.targetProviders,
        (providerId) => Effect.gen(function* () {
          const client = providers[providerId];
          if (!client) return null;

          const result = yield* Effect.tryPromise({
            try: () => client.getRates({
              route: input.route,
              amount: input.amount
            }),
            catch: (error) => {
              console.error(`[Aggregator] Failed to get rates from ${providerId} for route ${input.route.source.symbol}->${input.route.destination.symbol}:`, error);
              return error;
            }
          }).pipe(Effect.option);

          if (result._tag === 'Some') {
            const ratesResult = result.value as { rates: RateType[] };
            if (ratesResult.rates.length > 0) {
              return { providerId, rates: ratesResult.rates };
            }
          }
          return null;
        }),
        { concurrency: "unbounded" }
      );

      const data: Partial<Record<ProviderIdentifier, RateType[]>> = {};
      const successfulProviders: ProviderIdentifier[] = [];

      for (const result of results) {
        if (result) {
          const { providerId, rates } = result;
          data[providerId] = rates;
          successfulProviders.push(providerId);
        }
      }

      return {
        providers: successfulProviders,
        data: data as Record<ProviderIdentifier, RateType[]>,
      };
    })
  );
}
