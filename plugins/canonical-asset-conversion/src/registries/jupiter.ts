import { Context, Effect, Layer } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import { AssetStore, type AssetCriteria } from "../store";
import { assetToCanonicalIdentity } from "@data-provider/plugin-utils";

interface JupiterToken {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export class JupiterRegistry extends Context.Tag("JupiterRegistry")<
  JupiterRegistry,
  {
    readonly sync: () => Effect.Effect<number, Error>;
    readonly lookup: (criteria: AssetCriteria) => Effect.Effect<AssetType | null, Error>;
  }
>() {}

export const JupiterRegistryLive = Layer.effect(
  JupiterRegistry,
  Effect.gen(function* () {
    const store = yield* AssetStore;

    const searchTokens = (query: string): Effect.Effect<JupiterToken[], Error> =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(
            `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(query)}`
          );
          if (!response.ok) {
            const errorMsg = `Jupiter search failed for "${query}": ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          return (await response.json()) as JupiterToken[];
        },
        catch: (error) => {
          const errorMsg = `Jupiter search error for "${query}": ${error}`;
          console.error(errorMsg);
          return new Error(errorMsg);
        },
      });

    const convertToAsset = (token: JupiterToken): Effect.Effect<AssetType & { source: string }, Error> =>
      Effect.gen(function* () {
        const identity = yield* Effect.tryPromise(() =>
          assetToCanonicalIdentity({
            blockchain: "sol",
            namespace: "spl",
            reference: token.id,
          })
        );

        return {
          assetId: identity.assetId,
          blockchain: identity.blockchain,
          namespace: identity.namespace,
          reference: identity.reference,
          symbol: token.symbol,
          decimals: token.decimals,
          iconUrl: token.icon,
          source: "jupiter",
        };
      });

    return {
      sync: () =>
        Effect.gen(function* () {
          return 0;
        }),

      lookup: (criteria) =>
        Effect.gen(function* () {
          if (criteria.blockchain?.toLowerCase() !== "sol") {
            return null;
          }

          let searchQuery: string | null = null;

          if (criteria.reference) {
            searchQuery = criteria.reference;
          } else if (criteria.symbol) {
            searchQuery = criteria.symbol;
          }

          if (!searchQuery) {
            return null;
          }

          const results = yield* searchTokens(searchQuery);

          if (results.length === 0) {
            return null;
          }

          let selectedToken: JupiterToken | null = null;

          if (criteria.reference) {
            selectedToken = results.find(
              (t) => t.id.toLowerCase() === criteria.reference!.toLowerCase()
            ) ?? null;
          } else if (criteria.symbol) {
            selectedToken = results.find(
              (t) => t.symbol.toLowerCase() === criteria.symbol!.toLowerCase()
            ) ?? results[0] ?? null;
          } else {
            selectedToken = results[0] ?? null;
          }

          if (!selectedToken) {
            return null;
          }

          const asset = yield* convertToAsset(selectedToken);
          yield* store.upsert(asset);

          return asset;
        }).pipe(Effect.catchAll(() => Effect.succeed(null))),
    };
  })
);
