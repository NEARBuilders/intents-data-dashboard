import { client } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { ProviderIdentifier } from "../../../../plugins/aggregator/src/contract";

export function useListedAssets(providers?: ProviderIdentifier[], enabled: boolean = true) {
  return useQuery({
    queryKey: ["listed-assets", providers],
    queryFn: () => {
      return client.getListedAssets({
        providers: providers,
      });
    },
    enabled: enabled && (providers === undefined || providers.length > 0),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}
