import type { AssetType, ProviderIdentifier } from "../contract";

export async function buildAssetSupportIndex(
  providers: Partial<Record<ProviderIdentifier, any>>,
  targetProviders: ProviderIdentifier[]
): Promise<Map<string, Set<ProviderIdentifier>>> {
  const assetSupportIndex = new Map<string, Set<ProviderIdentifier>>();

  const results = await Promise.allSettled(
    targetProviders.map(async (providerId) => {
      const client = providers[providerId];
      if (!client) return null;

      try {
        const result = await client.getListedAssets();
        return { providerId, assets: result.assets };
      } catch (error) {
        console.error(`[Aggregator] Failed to get assets from ${providerId} for index:`, error);
        return null;
      }
    })
  );

  for (const result of results) {
    if (result?.status === 'fulfilled' && result.value) {
      const { providerId, assets } = result.value;
      for (const asset of assets) {
        if (!assetSupportIndex.has(asset.assetId)) {
          assetSupportIndex.set(asset.assetId, new Set());
        }
        assetSupportIndex.get(asset.assetId)!.add(providerId);
      }
    }
  }

  return assetSupportIndex;
}

export function getProvidersForRoute(
  route: { source: AssetType; destination: AssetType },
  assetSupportIndex: Map<string, Set<ProviderIdentifier>>
): ProviderIdentifier[] {
  const sourceProviders = assetSupportIndex.get(route.source.assetId) || new Set<ProviderIdentifier>();
  const destProviders = assetSupportIndex.get(route.destination.assetId) || new Set<ProviderIdentifier>();

  const intersection = [...sourceProviders].filter(p => destProviders.has(p));
  return intersection;
}

export async function aggregateListedAssets(
  providers: Partial<Record<ProviderIdentifier, any>>,
  targetProviders: ProviderIdentifier[]
): Promise<{
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, AssetType[]>;
}> {
  const results = await Promise.allSettled(
    targetProviders.map(async (providerId) => {
      const client = providers[providerId];
      if (!client) {
        console.warn(`[Aggregator] Provider ${providerId} not available`);
        return null;
      }

      try {
        const result = await client.getListedAssets();
        return { providerId, assets: result.assets };
      } catch (error) {
        console.error(`[Aggregator] Failed to get assets from ${providerId}:`, error);
        return null;
      }
    })
  );

  const data: Partial<Record<ProviderIdentifier, AssetType[]>> = {};
  const successfulProviders: ProviderIdentifier[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const providerId = targetProviders[i]!;

    if (result?.status === 'fulfilled' && result.value) {
      data[providerId] = result.value.assets;
      successfulProviders.push(providerId);
    }
  }

  return {
    providers: successfulProviders,
    data: data as Record<ProviderIdentifier, AssetType[]>,
  };
}
