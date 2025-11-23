import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { contract } from "@data-provider/shared-contract";
import { AcrossApiClient } from "./client";
import { AcrossService } from "./service";

export default createPlugin({
  variables: z.object({
    baseUrl: z.url().default("https://app.across.to/api"),
    timeout: z.number().min(1000).max(60000).default(30000),
  }),

  secrets: z.object({
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const client = new AcrossApiClient(
        config.variables.baseUrl,
        config.variables.timeout,
      );

      const service = new AcrossService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
