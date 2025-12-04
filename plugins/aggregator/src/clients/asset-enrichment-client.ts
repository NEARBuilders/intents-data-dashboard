import type { contract as AssetEnrichmentContract } from "@data-provider/asset-enrichment";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

export function createAssetEnrichmentClient(baseUrl: string) {
  const link = new RPCLink({
    url: baseUrl,
  });

  // @ts-expect-error some nested client thing
  return createORPCClient<typeof AssetEnrichmentContract>(link);
}
