import type { AssetType, RateType } from "@data-provider/shared-contract";
import type { ProviderIdentifier } from "../contract";
import { getProvidersForRoute } from "./assets";

export async function aggregateRates(
  providers: Partial<Record<ProviderIdentifier, any>>,
  input: {
    routes: Array<{ source: AssetType; destination: AssetType }>;
    notionals: string[];
    targetProviders: ProviderIdentifier[];
  },
  assetSupportIndex: Map<string, Set<ProviderIdentifier>>
): Promise<{
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, RateType[]>;
}> {
  const providerRouteMap = new Map<ProviderIdentifier, typeof input.routes>();

  for (const route of input.routes) {
    const supportingProviders = getProvidersForRoute(route, assetSupportIndex);

    const filteredProviders = input.targetProviders.filter(p => supportingProviders.includes(p));

    for (const providerId of filteredProviders) {
      if (!providerRouteMap.has(providerId)) {
        providerRouteMap.set(providerId, []);
      }
      providerRouteMap.get(providerId)!.push(route);
    }
  }

  const results = await Promise.allSettled(
    Array.from(providerRouteMap.entries()).map(async ([providerId, routes]) => {
      const client = providers[providerId];
      if (!client) return null;

      try {
        const result = await client.getRates({
          routes,
          notionals: input.notionals
        });
        return { providerId, rates: result.rates };
      } catch (error) {
        console.error(`[Aggregator] Failed to get rates from ${providerId}:`, error);
        return null;
      }
    })
  );

  const data: Partial<Record<ProviderIdentifier, RateType[]>> = {};
  const successfulProviders: ProviderIdentifier[] = [];

  for (const result of results) {
    if (result?.status === 'fulfilled' && result.value) {
      const { providerId, rates } = result.value;
      data[providerId] = rates;
      successfulProviders.push(providerId);
    }
  }

  return {
    providers: successfulProviders,
    data: data as Record<ProviderIdentifier, RateType[]>,
  };
}
