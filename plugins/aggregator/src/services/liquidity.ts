import type { AssetType, LiquidityDepthType } from "@data-provider/shared-contract";
import type { ProviderIdentifier } from "../contract";
import { getProvidersForRoute } from "./assets";

export async function aggregateLiquidity(
  providers: Partial<Record<ProviderIdentifier, any>>,
  input: {
    routes: Array<{ source: AssetType; destination: AssetType }>;
    targetProviders: ProviderIdentifier[];
  },
  assetSupportIndex: Map<string, Set<ProviderIdentifier>>
): Promise<{
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, LiquidityDepthType[]>;
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
        const result = await client.getLiquidity({ routes });
        return { providerId, liquidity: result.liquidity };
      } catch (error) {
        console.error(`[Aggregator] Failed to get liquidity from ${providerId}:`, error);
        return null;
      }
    })
  );

  const data: Partial<Record<ProviderIdentifier, LiquidityDepthType[]>> = {};
  const successfulProviders: ProviderIdentifier[] = [];

  for (const result of results) {
    if (result?.status === 'fulfilled' && result.value) {
      const { providerId, liquidity } = result.value;
      data[providerId] = liquidity;
      successfulProviders.push(providerId);
    }
  }

  return {
    providers: successfulProviders,
    data: data as Record<ProviderIdentifier, LiquidityDepthType[]>,
  };
}
