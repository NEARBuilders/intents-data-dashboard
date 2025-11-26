import type { Asset, Route } from "@/types/common";

export type AnalyticsEvent =
  | {
      type: "route_selected";
      source: Asset;
      destination: Asset;
    }
  | {
      type: "asset_search_no_results";
      direction: "source" | "destination";
      networkId: string | undefined;
      query: string;
    }
  | {
      type: "provider_gap";
      route: Route;
      missingProviderId: string;
      hasOtherProviders: boolean;
    };

export const logEvent = async (event: AnalyticsEvent): Promise<void> => {
  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.warn("Failed to log analytics event:", error);
  }
};
