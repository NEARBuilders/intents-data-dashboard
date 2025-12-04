import type { contract as AssetEnrichmentContract } from "@data-provider/asset-enrichment";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "every-plugin/orpc";

export function createAssetEnrichmentClient(baseUrl: string) {
  const link = new RPCLink({
    url: baseUrl,
  });

  const client: ContractRouterClient<typeof AssetEnrichmentContract> = createORPCClient(link);

  return client;
}
