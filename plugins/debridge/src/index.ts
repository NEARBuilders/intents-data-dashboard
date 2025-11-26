import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { DeBridgeApiClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { DeBridgeService } from "./service";

/**
 * deBridge DLN Data Provider Plugin
 *
 * Provides cross-chain bridge metrics from deBridge Liquidity Network (DLN).
 * deBridge enables fast, single-transaction cross-chain swaps without locking assets.
 *
 * Key Features:
 * - DefiLlama integration for volume metrics
 * - Comprehensive asset listing from supported-chains-info API
 * - Single-call liquidity detection using maxTheoreticalAmount
 * - Accurate fee calculation from USD value differences
 * - Rate limiting and automatic retries
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://dln.debridge.finance"),
    defillamaBaseUrl: z.string().url().default("https://bridges.llama.fi"),
    timeout: z.number().min(1000).max(60000).default(30000),
    maxRequestsPerSecond: z.number().min(1).max(100).default(10),
  }),

  secrets: z.object({
    apiKey: z.string().default("not-required"),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const client = new DeBridgeApiClient(
        config.variables.baseUrl,
        config.variables.defillamaBaseUrl,
        config.secrets.apiKey,
        config.variables.timeout,
        config.variables.maxRequestsPerSecond
      );

      const service = new DeBridgeService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;
    return createProviderRouter(service, builder);
  }
});
