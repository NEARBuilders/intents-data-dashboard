import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { LayerZeroApiClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { LayerZeroService } from "./service";

/**
 * LayerZero/Stargate Data Provider Plugin
 *
 * LayerZero is a message passing protocol with Stargate as its bridge application.
 * This plugin integrates with Stargate Finance API and DefiLlama to collect volume, rates, and liquidity data.
 *
 * Key features:
 * - Chain key system for Stargate API
 * - Token metadata with USD pricing
 * - Binary search liquidity depth
 * - DefiLlama volume metrics (bridge ID 84)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://stargate.finance/api/v1"),
    timeout: z.number().min(1000).max(60000).default(15000),
  }),

  secrets: z.object({}),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const client = new LayerZeroApiClient(
        config.variables.baseUrl,
        config.variables.timeout
      );

      const service = new LayerZeroService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
