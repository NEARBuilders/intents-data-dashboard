import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { WormholeApiClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { WormholeService } from "./service";

/**
 * Wormhole Data Provider Plugin
 *
 * Wormhole is a message passing protocol enabling cross-chain token transfers.
 * This plugin integrates with Wormholescan API and DefiLlama to collect volume, rates, and liquidity data.
 *
 * Key features:
 * - Governor API integration for real liquidity limits
 * - DefiLlama volume metrics (bridge ID 77)
 * - Protocol fee (0.01%) + chain-specific relayer fees
 * - Public API (no authentication required)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://api.wormholescan.io/api/v1"),
    timeout: z.number().min(1000).max(60000).default(15000),
    maxRequestsPerSecond: z.number().min(1).max(100).default(10),
  }),

  secrets: z.object({}),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const client = new WormholeApiClient(
        config.variables.baseUrl,
        config.variables.timeout
      );

      const service = new WormholeService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
