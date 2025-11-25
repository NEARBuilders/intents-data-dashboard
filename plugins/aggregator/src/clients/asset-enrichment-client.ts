import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { contract as AssetEnrichmentContract } from "@data-provider/asset-enrichment/src/contract";
import type { ContractRouterClient } from "every-plugin/orpc";

export function createAssetEnrichmentClient(baseUrl: string): ContractRouterClient<typeof AssetEnrichmentContract> {
  const link = new RPCLink({
    url: baseUrl,
  });

  return createORPCClient<typeof AssetEnrichmentContract>(link) as ContractRouterClient<typeof AssetEnrichmentContract>;
}
