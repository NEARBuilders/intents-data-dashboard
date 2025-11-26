import {
  amountAtom,
  destAssetAtom,
  selectedProviderAtom,
  sourceAssetAtom,
} from "@/store/swap";
import type { Route } from "@/types/common";
import { client } from "@/utils/orpc";
import type { ProviderIdentifier, TimePeriod } from "@data-provider/aggregator/src/contract";
import { useAtom } from "@effect-atom/atom-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useRates(
  route: Route | null,
  providers: ProviderIdentifier[],
  amount: string
) {
  const enabled = !!route && providers.length > 0 && !!amount;
  return useQuery({
    queryKey: ["rates", ...providers, route, amount],
    queryFn: () => {
      if (!route) return null;
      return client.getRates({
        route,
        amount,
        providers,
      });
    },
    enabled,
    refetchOnWindowFocus: false,
  });
}

export function useLiquidity(
  route: Route | null,
  providers: ProviderIdentifier[]
) {
  const enabled = !!route && providers.length > 0;

  return useQuery({
    queryKey: ["liquidity", ...providers, route],
    queryFn: () => {
      if (!route) return null;
      return client.getLiquidity({
        route,
        providers,
      });
    },
    enabled,
    refetchOnWindowFocus: false,
  });
}

export function useVolumes(period: TimePeriod = "all") {
  const [sourceAsset] = useAtom(sourceAssetAtom);
  const [destAsset] = useAtom(destAssetAtom);
  const [selectedProvider] = useAtom(selectedProviderAtom);

  const route = useMemo(() => {
    if (!sourceAsset || !destAsset) return null;
    return { source: sourceAsset, destination: destAsset };
  }, [sourceAsset, destAsset]);

  const providers: ProviderIdentifier[] = useMemo(() => {
    const list: ProviderIdentifier[] = ["near_intents"];
    if (selectedProvider) list.push(selectedProvider as ProviderIdentifier);
    return list;
  }, [selectedProvider]);

  const enabled = !!route && providers.length > 0;

  return useQuery({
    queryKey: ["volumes", period, ...providers, route],
    queryFn: async () => {
      if (!route) return null;
      try {
        return await client.getVolumesAggregated({
          period,
          providers,
          route,
        });
      } catch (error) {
        console.warn('[useVolumes] Failed to fetch volumes:', error);
        return null;
      }
    },
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export interface ProviderQuote {
  provider: ProviderIdentifier;
  rate: any | null;
  liquidity?: any;
}

export function useRouteQuotes() {
  const [sourceAsset] = useAtom(sourceAssetAtom);
  const [destAsset] = useAtom(destAssetAtom);
  const [amount] = useAtom(amountAtom);
  const [selectedProvider] = useAtom(selectedProviderAtom);

  const providers: ProviderIdentifier[] = useMemo(() => {
    const list: ProviderIdentifier[] = ["near_intents"];
    if (selectedProvider) list.push(selectedProvider as ProviderIdentifier);
    return list;
  }, [selectedProvider]);

  const route = useMemo(() => {
    if (!sourceAsset || !destAsset) return null;
    return { source: sourceAsset, destination: destAsset };
  }, [sourceAsset, destAsset]);

  const amountInWei = useMemo(() => {
    if (!amount || !sourceAsset || amount <= 0) return "";
    return BigInt(
      Math.floor(amount * 10 ** sourceAsset.decimals)
    ).toString();
  }, [amount, sourceAsset?.decimals]);

  const { data: ratesData, isLoading: ratesLoading, error: ratesError } = useRates(
    route,
    providers,
    amountInWei
  );

  const { data: liquidityData, isLoading: liquidityLoading } = useLiquidity(
    route,
    providers
  );

  const quotes = useMemo(() => {
    if (!ratesData || !providers.length) return [];

    const result: ProviderQuote[] = [];
    for (const provider of providers) {
      const rateList = ratesData.data?.[provider] ?? [];
      const liqList = liquidityData?.data?.[provider] ?? [];

      result.push({
        provider,
        rate: rateList[0] ?? null,
        liquidity: liqList[0],
      });
    }
    return result;
  }, [ratesData, liquidityData, providers]);

  return {
    quotes,
    loading: ratesLoading || liquidityLoading,
    error: ratesError instanceof Error ? ratesError.message : null,
  };
}
