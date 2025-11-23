import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { IntentsClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { IntentsService } from "./service";

export default createPlugin({
  variables: z.object({
    baseUrl: z.url().default("https://1click.chaindefuser.com"),
    timeout: z.number().min(1000).max(60000).default(30000),
  }),

  secrets: z.object({
    apiKey: z.string().optional(), // JWT for 1Click and Explorer APIs
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create HTTP client for both APIs
      const client = new IntentsClient(
        config.variables.baseUrl,
        "https://explorer.near-intents.org",
        config.secrets.apiKey,
        config.variables.timeout
      );

      // Create service instance
      const service = new IntentsService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
