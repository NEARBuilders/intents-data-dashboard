import type { AssetType, PluginClient } from "@data-provider/shared-contract";
import { Effect } from "every-plugin/effect";
import type { ProviderIdentifier } from "../contract";
import type { RedisService } from "./redis";

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
  targetProviders: ProviderIdentifier[],
  redis?: RedisService
): Promise<{
  providers: ProviderIdentifier[];
  data: Record<ProviderIdentifier, AssetType[]>;
}> {
  const ASSETS_CACHE_TTL = 60 * 60;

  const data: Partial<Record<ProviderIdentifier, AssetType[]>> = {};
  const successfulProviders: ProviderIdentifier[] = [];
  const providersToFetch: ProviderIdentifier[] = [];

  if (redis) {
    for (const providerId of targetProviders) {
      const cacheKey = `assets:${providerId}`;
      try {
        const cached = await Effect.runPromise(redis.get<AssetType[]>(cacheKey));
        if (cached) {
          data[providerId] = cached;
          successfulProviders.push(providerId);
          console.log(`[Aggregator] Using cached assets for ${providerId}`);
        } else {
          providersToFetch.push(providerId);
        }
      } catch (error) {
        console.warn(`[Aggregator] Cache check failed for ${providerId}:`, error);
        providersToFetch.push(providerId);
      }
    }
  } else {
    providersToFetch.push(...targetProviders);
  }

  if (providersToFetch.length === 0) {
    return {
      providers: successfulProviders,
      data: data as Record<ProviderIdentifier, AssetType[]>,
    };
  }

  const results = await Promise.allSettled(
    providersToFetch.map(async (providerId) => {
      const client = providers[providerId] as PluginClient;
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

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const providerId = providersToFetch[i]!;

    if (result?.status === 'fulfilled' && result.value) {
      const assets = result.value.assets;

      data[providerId] = assets;
      successfulProviders.push(providerId);

      if (redis) {
        const cacheKey = `assets:${providerId}`;
        try {
          await Effect.runPromise(redis.set<AssetType[]>(cacheKey, assets, ASSETS_CACHE_TTL));
          console.log(`[Aggregator] Cached ${assets.length} assets for ${providerId} (TTL: 1 hour)`);
        } catch (error) {
          console.warn(`[Aggregator] Failed to cache assets for ${providerId}:`, error);
        }
      }
    }
  }

  return {
    providers: successfulProviders,
    data: data as Record<ProviderIdentifier, AssetType[]>,
  };
}
