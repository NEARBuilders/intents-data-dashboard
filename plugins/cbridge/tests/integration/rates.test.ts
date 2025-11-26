import { describe, expect, it } from "vitest";
import { getPluginClient, testRoutes } from "../setup";

describe("Rate Quotes", () => {
  it("returns quote for route and amount", async () => {
    const client = await getPluginClient();
    const result = await client.getRates({
      route: testRoutes[0]!,
      amount: "1000000"
    });

    console.log("\n💰 Rates:", JSON.stringify({
      count: result.rates.length,
      sample: result.rates.slice(0, 2).map(r => ({
        amountIn: r.amountIn,
        amountOut: r.amountOut,
        effectiveRate: r.effectiveRate
      }))
    }, null, 2));

    expect(result.rates.length).toBeGreaterThanOrEqual(1);
    result.rates.forEach(rate => {
      expect(rate.source).toEqual(testRoutes[0]!.source);
      expect(rate.destination).toEqual(testRoutes[0]!.destination);
      expect(rate.amountIn).toBeDefined();
      expect(rate.amountOut).toBeDefined();
      expect(rate.effectiveRate).toBeGreaterThan(0);
      expect(rate.quotedAt).toBeDefined();
    });
  });
});
