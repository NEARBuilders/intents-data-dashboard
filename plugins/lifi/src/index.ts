import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { LiFiApiClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { LiFiService } from "./service";

/**
 * Li.Fi Data Provider Plugin
 *
 * Li.Fi is a cross-chain bridge aggregator that routes transfers across multiple bridges.
 * This plugin integrates with Li.Fi API v1 and v2 to collect volume, rates, and liquidity data.
 *
 * Key features:
 * - Multi-chain support across 20+ networks
 * - Analytics API for real volume metrics
 * - Quote API for rate estimation
 * - Public API (no authentication required)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://li.quest/v1"),
    timeout: z.number().min(1000).max(60000).default(10000),
  }),

  secrets: z.object({}),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const client = new LiFiApiClient(
        config.variables.baseUrl,
        config.variables.timeout
      );

      const service = new LiFiService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
