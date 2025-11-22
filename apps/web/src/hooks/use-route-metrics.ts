import type { Route } from "@/types/common";
import { client } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";

export function useRates(
  route: Route | null,
  providers: string[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["rates", ...providers, route],
    queryFn: () => {
      if (!route) return null;
      return client.getRates({
        routes: [route],
        notionals: ["1000000"],
        providers: providers,
      });
    },
    enabled: enabled && !!route && providers.length > 0,
    refetchOnWindowFocus: false,
  });
}


export function useLiquidity(
  route: Route | null,
  providers: string[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["liquidity", ...providers, route],
    queryFn: () => {
      if (!route) return null;
      return client.getLiquidity({
        routes: [route],
        providers: providers,
      });
    },
    enabled: enabled && !!route && providers.length > 0,
    refetchOnWindowFocus: false,
  });
}

export function useVolumes(
  route: Route | null,
  providers: string[],
  period: "7d" | "30d" | "90d" | "all" = "all",
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["volumes", period, ...providers, route],
    queryFn: () => {
      if (!route) return null;
      return client.getVolumesAggregated({
        period,
        providers: providers,
        route,
      });
    },
    enabled: enabled && !!route && providers.length > 0,
    refetchOnWindowFocus: false,
  });
}
