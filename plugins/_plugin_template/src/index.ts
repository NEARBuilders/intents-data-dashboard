import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { ProviderApiClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { DataProviderService } from "./service";

/**
 * Data Provider Plugin Template
 *
 * This template demonstrates the single-route + middleware architecture for data provider plugins.
 * Key architectural patterns:
 *
 * 1. **Two-Format Architecture**: Plugin works with both provider-specific format and canonical 1cs_v1 format
 *    - Provider Format: Matches external API (ProviderAssetType in client.ts)
 *    - Canonical Format: Standardized 1cs_v1 asset IDs (AssetType, RouteType from shared-contract)
 *
 * 2. **Layer Separation**:
 *    - Client Layer: All HTTP communication with provider APIs
 *    - Service Layer: Business logic in provider format, calls client methods
 *    - Router Layer: Transformation between formats using Effect for reliability
 *    - Middleware Layer: Automatic route transformation from canonical to provider format
 *
 * 3. **Single-Route Processing**: APIs accept one route at a time for rates/liquidity
 *    - Input: Single route with source and destination assets
 *    - Middleware: Transforms canonical route.source and route.destination to provider format
 *    - Service: Processes single route, returns array of results (e.g., multiple notionals)
 *
 * 4. **Reliability Pattern**: Effect-based error handling ensures partial success
 *    - Individual asset/route failures are logged but don't crash the entire response
 *    - Aggregator-friendly: returns valid data even when some items fail conversion
 *
 * 5. **Transformation Functions**:
 *    - Canonical 1cs_v1 → Provider: Parse asset IDs for API queries
 *    - Provider → Canonical 1cs_v1: Stringify provider data to canonical format
 *
 * Workflow:
 * Client Request (Canonical route) → Middleware transforms to Provider route → Service (Provider format)
 * Service Response (Provider) → Router transforms to Canonical → Client Response (Canonical)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.url().default("https://api.example.com"),
    timeout: z.number().min(1000).max(60000).default(10000),
  }),

  secrets: z.object({
    apiKey: z.string().min(1, "API key is required"),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create HTTP client for API communication
      const client = new ProviderApiClient(
        config.variables.baseUrl,
        config.secrets.apiKey,
        config.variables.timeout
      );

      // Create service instance with client
      const service = new DataProviderService(client);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
