import { assetToCanonicalIdentity } from "@data-provider/plugin-utils";
import type { AssetType } from "@data-provider/shared-contract";
import { like } from "drizzle-orm";
import { Context, Effect, Layer, RateLimiter } from "every-plugin/effect";
import * as schema from "../db/schema";
import { AssetStore, Database, type AssetCriteria } from "../store";

interface CoingeckoCoin {
  id: string;
  symbol: string;
  name: string;
}

interface CoingeckoCoinDetail {
  id: string;
  symbol: string;
  name: string;
  detail_platforms?: Record<string, { decimal_place?: number }>;
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
}

interface CoingeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
}

const BLOCKCHAIN_TO_PLATFORM: Record<string, string> = {
  eth: "ethereum",
  arb: "arbitrum-one",
  pol: "polygon-pos",
  bsc: "binance-smart-chain",
  op: "optimistic-ethereum",
  base: "base",
  sol: "solana",
  near: "near-protocol",
  avax: "avalanche",
  ftm: "fantom",
  celo: "celo",
};

const NATIVE_COINS: Record<string, { id: string; decimals: number }> = {
  eth: { id: "ethereum", decimals: 18 },
  arb: { id: "ethereum", decimals: 18 },
  op: { id: "ethereum", decimals: 18 },
  base: { id: "ethereum", decimals: 18 },
  "arb-nova": { id: "ethereum", decimals: 18 },
  zora: { id: "ethereum", decimals: 18 },
  pol: { id: "matic-network", decimals: 18 },
  polygon: { id: "matic-network", decimals: 18 },
  matic: { id: "matic-network", decimals: 18 },
  "polygon-zkevm": { id: "ethereum", decimals: 18 },
  bsc: { id: "binancecoin", decimals: 18 },
  bnb: { id: "binancecoin", decimals: 18 },
  opbnb: { id: "binancecoin", decimals: 18 },
  avax: { id: "avalanche-2", decimals: 18 },
  avalanche: { id: "avalanche-2", decimals: 18 },
  ftm: { id: "fantom", decimals: 18 },
  fantom: { id: "fantom", decimals: 18 },
  celo: { id: "celo", decimals: 18 },
  gnosis: { id: "xdai", decimals: 18 },
  zksync: { id: "ethereum", decimals: 18 },
  linea: { id: "ethereum", decimals: 18 },
  mantle: { id: "mantle", decimals: 18 },
  scroll: { id: "ethereum", decimals: 18 },
  manta: { id: "ethereum", decimals: 18 },
  mode: { id: "ethereum", decimals: 18 },
  blast: { id: "ethereum", decimals: 18 },
  sol: { id: "solana", decimals: 9 },
  near: { id: "near", decimals: 24 },
  ton: { id: "the-open-network", decimals: 9 },
  aptos: { id: "aptos", decimals: 8 },
  sui: { id: "sui", decimals: 9 },
  btc: { id: "bitcoin", decimals: 8 },
  zec: { id: "zcash", decimals: 8 },
  ltc: { id: "litecoin", decimals: 8 },
  doge: { id: "dogecoin", decimals: 8 },
  xrp: { id: "ripple", decimals: 6 },
  xlm: { id: "stellar", decimals: 7 },
  ada: { id: "cardano", decimals: 6 },
  dot: { id: "polkadot", decimals: 10 },
  cosmos: { id: "cosmos", decimals: 6 },
  osmo: { id: "osmosis", decimals: 6 },
  atom: { id: "cosmos", decimals: 6 },
  algo: { id: "algorand", decimals: 6 },
  tezos: { id: "tezos", decimals: 6 },
  xtz: { id: "tezos", decimals: 6 },
};

export class CoingeckoRegistry extends Context.Tag("CoingeckoRegistry")<
  CoingeckoRegistry,
  {
    readonly sync: () => Effect.Effect<number, Error>;
    readonly lookup: (criteria: AssetCriteria) => Effect.Effect<AssetType | null, Error>;
    readonly getPrice: (assetId: string) => Effect.Effect<{ price: number | null; timestamp: number | null }, Error>;
  }
>() { }

export const CoingeckoRegistryLive = Layer.scoped(
  CoingeckoRegistry,
  Effect.gen(function* () {
    const store = yield* AssetStore;
    const db = yield* Database;

    const rateLimiter = yield* RateLimiter.make({
      limit: 14,
      interval: "1 minutes",
    });

    const fetchCoinsList = Effect.tryPromise({
      try: async () => {
        const response = await fetch("https://api.coingecko.com/api/v3/coins/list");
        if (!response.ok) {
          const errorMsg = `Failed to fetch CoinGecko list: ${response.status} ${response.statusText}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
        return (await response.json()) as CoingeckoCoin[];
      },
      catch: (error) => {
        const errorMsg = `CoinGecko fetch error: ${error}`;
        console.error(errorMsg);
        return new Error(errorMsg);
      },
    });

    const fetchMarkets = (ids?: string[], perPage = 250): Effect.Effect<CoingeckoMarket[], Error> =>
      Effect.tryPromise({
        try: async () => {
          const params = new URLSearchParams({
            vs_currency: "usd",
            per_page: perPage.toString(),
          });
          if (ids && ids.length > 0) {
            params.set("ids", ids.join(","));
          }
          const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`);
          if (!response.ok) {
            const errorMsg = `Failed to fetch CoinGecko markets: ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          return (await response.json()) as CoingeckoMarket[];
        },
        catch: (error) => {
          const errorMsg = `CoinGecko markets fetch error: ${error}`;
          console.error(errorMsg);
          return new Error(errorMsg);
        },
      });

    const fetchCoinDetail = (coinId: string): Effect.Effect<CoingeckoCoinDetail, Error> =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(
            `https://api.coingecko.com/api/v3/coins?include_platform=true`
          );
          if (!response.ok) {
            const errorMsg = `Failed to fetch coin detail for ${coinId}: ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          return (await response.json()) as CoingeckoCoinDetail;
        },
        catch: (error) => {
          const errorMsg = `CoinGecko detail fetch error for ${coinId}: ${error}`;
          console.error(errorMsg);
          return new Error(errorMsg);
        },
      });

    const fuzzySearchCoingeckoId = (
      symbol: string,
      blockchain?: string
    ): Effect.Effect<string | null, Error> =>
      Effect.tryPromise({
        try: async () => {
          const results = await db
            .select()
            .from(schema.coingeckoIds)
            .where(like(schema.coingeckoIds.symbol, `%${symbol}%`))
            .limit(5);

          if (results.length === 0) {
            return null;
          }

          const exactMatch = results.find((r) => r.symbol.toLowerCase() === symbol.toLowerCase());
          if (exactMatch) {
            return exactMatch.id;
          }

          if (blockchain) {
            const nativeCoin = NATIVE_COINS[blockchain.toLowerCase()];
            if (nativeCoin) {
              const nativeMatch = results.find((r) => r.id === nativeCoin.id);
              if (nativeMatch) {
                return nativeMatch.id;
              }
            }
          }

          return results[0]!.id;
        },
        catch: (error) => new Error(`Fuzzy search error: ${error}`),
      });

    const convertDetailToAsset = (
      detail: CoingeckoCoinDetail,
      blockchain: string
    ): Effect.Effect<AssetType & { source: string }, Error> =>
      Effect.gen(function* () {
        const platformId = BLOCKCHAIN_TO_PLATFORM[blockchain.toLowerCase()];
        const decimals = platformId ? detail.detail_platforms?.[platformId]?.decimal_place ?? 18 : 18;
        const iconUrl = detail.image?.large || detail.image?.small || detail.image?.thumb;

        const isNative = NATIVE_COINS[blockchain.toLowerCase()]?.id === detail.id;
        const namespace = isNative ? "native" : "erc20";
        const reference = isNative ? "coin" : "";

        const identity = yield* Effect.tryPromise(() =>
          assetToCanonicalIdentity({
            blockchain,
            namespace,
            reference,
          })
        );

        return {
          assetId: identity.assetId,
          blockchain: identity.blockchain,
          namespace: identity.namespace,
          reference: identity.reference,
          symbol: detail.symbol.toUpperCase(),
          name: detail.name,
          decimals,
          iconUrl,
          source: "coingecko",
        };
      });

    const nativeCoinIds = [...new Set(Object.values(NATIVE_COINS).map((c) => c.id))];

    const blockchainByNativeCoinId: Record<string, string[]> = {};
    for (const [blockchain, coin] of Object.entries(NATIVE_COINS)) {
      if (!blockchainByNativeCoinId[coin.id]) {
        blockchainByNativeCoinId[coin.id] = [];
      }
      blockchainByNativeCoinId[coin.id]!.push(blockchain);
    }

    const priceCache = new Map<string, { price: number; timestamp: number }>();
    const CACHE_TTL_MS = 3 * 60 * 1000;

    const fetchPrice = (coingeckoId: string): Effect.Effect<{ price: number | null; timestamp: number | null }, Error> =>
      Effect.tryPromise({
        try: async () => {
          const params = new URLSearchParams({
            ids: coingeckoId,
            vs_currencies: "usd",
            include_last_updated_at: "true",
          });
          const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`);
          if (!response.ok) {
            console.error(`Failed to fetch CoinGecko price for ${coingeckoId}: ${response.status}`);
            return { price: null, timestamp: null };
          }
          const data = await response.json() as Record<string, { usd?: number; last_updated_at?: number }>;
          const coinData = data[coingeckoId];
          if (!coinData || typeof coinData.usd !== 'number') {
            return { price: null, timestamp: null };
          }
          return {
            price: coinData.usd,
            timestamp: coinData.last_updated_at || Math.floor(Date.now() / 1000),
          };
        },
        catch: (error) => new Error(`CoinGecko price fetch error: ${error}`),
      });

    return {
      sync: () =>
        Effect.gen(function* () {
          console.log("Phase 1: Syncing CoinGecko coins list for fuzzy search...");
          const coinsList = yield* rateLimiter(fetchCoinsList);

          const chunkSize = 500;
          const chunks: CoingeckoCoin[][] = [];
          for (let i = 0; i < coinsList.length; i += chunkSize) {
            chunks.push(coinsList.slice(i, i + chunkSize));
          }

          console.log(`Processing ${coinsList.length} coins in ${chunks.length} batches...`);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            yield* Effect.tryPromise({
              try: async () => {
                await db
                  .insert(schema.coingeckoIds)
                  .values(
                    chunk.map((coin) => ({
                      id: coin.id,
                      symbol: coin.symbol,
                      name: coin.name,
                    }))
                  )
                  .onConflictDoNothing();
              },
              catch: () => new Error("Failed to batch insert coingecko IDs"),
            }).pipe(Effect.catchAll(() => Effect.void));

            if ((i + 1) % 10 === 0) {
              console.log(`Processed ${(i + 1) * chunkSize} / ${coinsList.length} coins...`);
            }
          }

          console.log(`Phase 1 complete: ${coinsList.length} coins indexed`);

          console.log("Phase 2: Fetching markets for native coins and top 250...");
          const nativeMarkets = yield* rateLimiter(fetchMarkets(nativeCoinIds)).pipe(
            Effect.catchAll(() => Effect.succeed([]))
          );
          const top250Markets = yield* rateLimiter(fetchMarkets(undefined, 250)).pipe(
            Effect.catchAll(() => Effect.succeed([]))
          );

          const allMarkets = [...nativeMarkets, ...top250Markets];
          const uniqueMarkets = Array.from(new Map(allMarkets.map((m) => [m.id, m])).values());

          let enhancedCount = 0;
          for (const market of uniqueMarkets) {
            const blockchains = blockchainByNativeCoinId[market.id];
            if (blockchains && blockchains.length > 0) {
              for (const blockchain of blockchains) {
                const nativeCoin = NATIVE_COINS[blockchain];
                if (nativeCoin) {
                  const identity = yield* Effect.tryPromise(() =>
                    assetToCanonicalIdentity({
                      blockchain,
                      namespace: "native",
                      reference: "coin",
                    })
                  ).pipe(Effect.catchAll(() => Effect.succeed(null)));

                  if (identity) {
                    const asset: AssetType & { source: string } = {
                      assetId: identity.assetId,
                      blockchain: identity.blockchain,
                      namespace: identity.namespace,
                      reference: identity.reference,
                      symbol: market.symbol.toUpperCase(),
                      name: market.name,
                      decimals: nativeCoin.decimals,
                      iconUrl: market.image,
                      source: "coingecko",
                    };

                    yield* store.upsert(asset).pipe(Effect.catchAll(() => Effect.void));
                    enhancedCount++;
                  }
                }
              }
            }
          }

          console.log(`Phase 2 complete: ${enhancedCount} native assets enhanced`);
          return coinsList.length + enhancedCount;
        }),

      lookup: (criteria) =>
        Effect.gen(function* () {
          if (!criteria.blockchain) {
            return null;
          }

          const blockchain = criteria.blockchain.toLowerCase();
          const platformId = BLOCKCHAIN_TO_PLATFORM[blockchain];

          if (!platformId && !NATIVE_COINS[blockchain]) {
            return null;
          }

          let coinId: string | null = null;

          if (criteria.reference === "coin") {
            coinId = NATIVE_COINS[blockchain]?.id || null;
          } else if (criteria.symbol) {
            coinId = yield* fuzzySearchCoingeckoId(criteria.symbol, blockchain);
          }

          if (!coinId) {
            return null;
          }

          const detail = yield* rateLimiter(fetchCoinDetail(coinId));
          const asset = yield* convertDetailToAsset(detail, blockchain);
          yield* store.upsert(asset);

          return asset;
        }).pipe(Effect.catchAll(() => Effect.succeed(null))),

      getPrice: (assetId) =>
        Effect.gen(function* () {
          const cached = priceCache.get(assetId);
          if (cached && Date.now() - cached.timestamp * 1000 < CACHE_TTL_MS) {
            return { price: cached.price, timestamp: cached.timestamp };
          }

          const asset = yield* store.find({ assetId });
          if (!asset) {
            return { price: null, timestamp: null };
          }

          let coingeckoId: string | null = null;

          if (asset.reference === "coin" && asset.blockchain) {
            coingeckoId = NATIVE_COINS[asset.blockchain.toLowerCase()]?.id || null;
          } else if (asset.symbol) {
            coingeckoId = yield* fuzzySearchCoingeckoId(asset.symbol, asset.blockchain);
          }

          if (!coingeckoId) {
            return { price: null, timestamp: null };
          }

          const result = yield* rateLimiter(fetchPrice(coingeckoId));
          
          if (result.price !== null && result.timestamp !== null) {
            priceCache.set(assetId, { price: result.price, timestamp: result.timestamp });
          }

          return result;
        }).pipe(Effect.catchAll(() => Effect.succeed({ price: null, timestamp: null }))),
    };
  })
);
