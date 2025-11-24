import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { CanonicalAssetService } from "./service";
import { CoingeckoRegistry } from "./registries/coingecko";

/**
 * Canonical Asset Conversion Plugin
 *
 * Central registry and conversion service for canonical 1cs_v1 asset identifiers.
 * Integrates with Coingecko and other registries to enrich asset metadata.
 *
 * Features:
 * - Normalize arbitrary asset descriptors into canonical Asset format
 * - Parse 1cs_v1 IDs and enrich with registry data (symbol, decimals, iconUrl)
 * - Build canonical 1cs_v1 IDs from blockchain/namespace/reference
 * - Cached registry lookups (Coingecko)
 * - Extensible for additional registries (CoinMarketCap, etc.)
 */
export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    COINGECKO_PRO_API_KEY: z.string().optional(),
    COINGECKO_DEMO_API_KEY: z.string().optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const registry = new CoingeckoRegistry({
        proAPIKey: config.secrets.COINGECKO_PRO_API_KEY ?? null,
        demoAPIKey: config.secrets.COINGECKO_DEMO_API_KEY ?? null,
      });

      const service = new CanonicalAssetService(registry);

      console.log("Canonical Asset Conversion plugin initialized");

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      normalize: builder.normalize.handler(async ({ input }) => {
        const result = await Effect.runPromise(service.normalize(input));
        return result;
      }),

      fromCanonicalId: builder.fromCanonicalId.handler(async ({ input }) => {
        const result = await Effect.runPromise(service.fromCanonicalId(input.assetId));
        return result;
      }),

      toCanonicalId: builder.toCanonicalId.handler(async ({ input }) => {
        const assetId = await Effect.runPromise(
          service.toCanonicalId(input.blockchain, input.namespace, input.reference)
        );
        return { assetId };
      }),

      getNetworks: builder.getNetworks.handler(async () => {
        const networks = await Effect.runPromise(service.getNetworks());
        return networks;
      }),

      ping: builder.ping.handler(async () => {
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
        };
      }),
    };
  },
});