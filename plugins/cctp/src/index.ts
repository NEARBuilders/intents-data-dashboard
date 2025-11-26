import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { CCTPApiClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { CCTPService } from "./service";

/**
 * CCTP (Circle Cross-Chain Transfer Protocol) Data Provider Plugin
 *
 * Circle's native burn-and-mint protocol for USDC cross-chain transfers.
 * This plugin integrates with Circle Iris API and DefiLlama to collect volume, rates, and liquidity data.
 *
 * Key features:
 * - USDC-only transfers (1:1 burn & mint)
 * - Domain ID system
 * - Fast Transfer Allowance for liquidity
 * - DefiLlama volume metrics (bridge ID 51)
 * - Public API (no authentication required)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://iris-api.circle.com"),
    timeout: z.number().min(1000).max(60000).default(15000),
  }),

  secrets: z.object({}),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const client = new CCTPApiClient(
        config.variables.baseUrl,
        config.variables.timeout
      );

      const service = new CCTPService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
