import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { CBridgeApiClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { CBridgeService } from "./service";

/**
 * cBridge Data Provider Plugin
 *
 * cBridge is Celer Network's cross-chain bridge protocol.
 * This plugin integrates with cBridge API to collect rates and liquidity data.
 *
 * Key features:
 * - Multi-chain support across 60+ networks
 * - Transfer configs API for chain/token metadata
 * - Estimate amount API for rate quotes
 * - No public volume API (returns empty arrays)
 * - Public API (no authentication required)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://cbridge-prod2.celer.app"),
    timeout: z.number().min(1000).max(60000).default(30000),
  }),

  secrets: z.object({}),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const client = new CBridgeApiClient(
        config.variables.baseUrl,
        config.variables.timeout
      );

      const service = new CBridgeService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
