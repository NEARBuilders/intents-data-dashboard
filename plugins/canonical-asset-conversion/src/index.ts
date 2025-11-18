import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { CanonicalAssetService } from "./service";

/**
 * Canonical Asset Conversion Plugin
 *
 * Provides standardized 1cs_v1 canonical asset identifiers for cross-chain asset handling.
 * Used to convert between provider-specific asset formats and the unified 1cs_v1 standard.
 *
 * Features:
 * - Convert provider assets to 1cs_v1 canonical format
 * - Parse 1cs_v1 format back to structured asset details
 * - Lazy caching of EVM chain data from chainlist.network
 * - Static mappings for non-EVM chains (Solana, TON, NEAR, etc.)
 * - Extensible namespace system for future chains/standards
 */
export default createPlugin({
  variables: z.object({}), // No external configuration needed

  secrets: z.object({}), // No API keys required

  contract,

  initialize: (config) =>
    Effect.gen(function* () {

      const service = new CanonicalAssetService();

      console.log("Canonical Asset Conversion plugin initialized");

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      // FROM standard format → convert TO canonical
      from: builder.from.handler(async ({ input }) => {
        const result = await Effect.runPromise(service.toCanonical(input));
        return result;
      }),

      // TO standard format ← convert FROM canonical
      to: builder.to.handler(async ({ input }) => {
        const result = await Effect.runPromise(service.fromCanonical(input.canonical));
        return result;
      }),

      ping: builder.ping.handler(async () => {
        // Simple health check without additional logic
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
        };
      })
    };
  }
});
