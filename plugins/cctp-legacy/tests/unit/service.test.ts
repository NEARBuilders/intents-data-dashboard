import Plugin from "@/index";
import type { ProviderSnapshotType } from "@data-provider/shared-contract";
import type { PluginRegistry } from "every-plugin";
import { createLocalPluginRuntime } from "every-plugin/testing";
import { describe, expect, it } from "vitest";
import pluginDevConfig, { sampleRoute } from "../../plugin.dev";

function logTestSummary(result: ProviderSnapshotType, testName: string) {
  const uniqueAssets = new Set(
    result.listedAssets.assets.map((a) => `${a.chainId}:${a.assetId}`)
  );

  const vol24h = result.volumes.find((v) => v.window === '24h');
  const vol7d = result.volumes.find((v) => v.window === '7d');
  const vol30d = result.volumes.find((v) => v.window === '30d');

  console.log(`\n📊 ${testName}`);
  console.log(`   ✓ Unique Assets: ${uniqueAssets.size}`);
  console.log(`   ✓ Volume (24h): $${vol24h?.volumeUsd.toLocaleString() ?? '0'}`);
  console.log(`   ✓ Volume (7d):  $${vol7d?.volumeUsd.toLocaleString() ?? '0'}`);
  console.log(`   ✓ Volume (30d): $${vol30d?.volumeUsd.toLocaleString() ?? '0'}`);

  if (result.rates && result.rates.length > 0) {
    const avgRate = result.rates.reduce((sum, r) => sum + r.effectiveRate, 0) / result.rates.length;
    console.log(`   ✓ Rates: ${result.rates.length} quotes (avg: ${avgRate.toFixed(4)})`);
  }

  if (result.liquidity && result.liquidity.length > 0) {
    console.log(`   ✓ Liquidity: ${result.liquidity.length} routes measured`);
  }
}

const TEST_PLUGIN_ID = pluginDevConfig.pluginId;
const TEST_CONFIG = pluginDevConfig.config;

const TEST_REGISTRY: PluginRegistry = {
  [TEST_PLUGIN_ID]: {
    remoteUrl: "http://localhost:3000/remoteEntry.js",
    version: "1.0.0",
    description: "Data provider unit testing",
  },
};

const TEST_PLUGIN_MAP = {
  [TEST_PLUGIN_ID]: Plugin,
} as const;

describe("DataProviderService", () => {
  const runtime = createLocalPluginRuntime<typeof TEST_PLUGIN_MAP>(
    {
      registry: TEST_REGISTRY,
      secrets: {},
    },
    TEST_PLUGIN_MAP
  );

  describe("getSnapshot", () => {
    it("should return complete snapshot structure", async () => {
      const { client } = await runtime.usePlugin(TEST_PLUGIN_ID, TEST_CONFIG);

      const result = await client.getSnapshot({
        routes: [sampleRoute],
        notionals: ["1000", "10000"],
        includeWindows: ["24h", "7d", "30d"]
      })

      expect(result).toHaveProperty("volumes");
      expect(result).toHaveProperty("listedAssets");
      expect(Array.isArray(result.volumes)).toBe(true);
      expect(Array.isArray(result.listedAssets.assets)).toBe(true);

      if (result.rates) {
        expect(Array.isArray(result.rates)).toBe(true);
      }
      if (result.liquidity) {
        expect(Array.isArray(result.liquidity)).toBe(true);
      }

      logTestSummary(result, "Complete Snapshot Structure");
    });

    it("should validate volume data and listed assets", async () => {
      const { client } = await runtime.usePlugin(TEST_PLUGIN_ID, TEST_CONFIG);

      const result = await client.getSnapshot({
        routes: [sampleRoute],
        notionals: ["1000"],
        includeWindows: ["24h", "7d", "30d"]
      })

      expect(result.volumes.length,
        "❌ No volume data returned. Implement getVolumes() in service.ts"
      ).toBeGreaterThan(0);

      expect(result.listedAssets.assets.length,
        "❌ No assets returned. Implement getListedAssets() in service.ts"
      ).toBeGreaterThan(0);

      const volumes = {
        "24h": result.volumes.find(v => v.window === "24h"),
        "7d": result.volumes.find(v => v.window === "7d"),
        "30d": result.volumes.find(v => v.window === "30d"),
      };

      expect(volumes["24h"], "Missing 24h volume window").toBeDefined();
      expect(volumes["7d"], "Missing 7d volume window").toBeDefined();
      expect(volumes["30d"], "Missing 30d volume window").toBeDefined();

      expect(volumes["24h"]!.volumeUsd).toBeGreaterThan(0);
      expect(volumes["7d"]!.volumeUsd).toBeGreaterThan(0);
      expect(volumes["30d"]!.volumeUsd).toBeGreaterThan(0);

      expect(volumes["7d"]!.volumeUsd).toBeGreaterThanOrEqual(volumes["24h"]!.volumeUsd);
      expect(volumes["30d"]!.volumeUsd).toBeGreaterThanOrEqual(volumes["7d"]!.volumeUsd);

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      result.volumes.forEach(v => {
        expect(new Date(v.measuredAt).getTime()).toBeGreaterThan(oneHourAgo);
      });

      const assetKeys = new Set<string>();
      result.listedAssets.assets.forEach(asset => {
        const key = `${asset.chainId}:${asset.assetId}`;
        expect(assetKeys.has(key), `Duplicate asset found: ${key}`).toBe(false);
        assetKeys.add(key);
      });

      const oneHourAgoForAssets = Date.now() - 60 * 60 * 1000;
      expect(new Date(result.listedAssets.measuredAt).getTime()).toBeGreaterThan(oneHourAgoForAssets);

      logTestSummary(result, "Volume Data & Listed Assets");
    });

    it("should validate rates when provided", async () => {
      const { client } = await runtime.usePlugin(TEST_PLUGIN_ID, TEST_CONFIG);

      const result = await client.getSnapshot({
        routes: [sampleRoute],
        notionals: ["1000", "10000"],
        includeWindows: ["24h"]
      })

      if (!result.rates || result.rates.length === 0) {
        throw new Error("❌ Expected rates to be present for routes with notionals. Implement getRates() in service.ts");
      }

      expect(result.rates.length, "Should return rates for each notional").toBe(2);

      result.rates.forEach(rate => {
        expect(rate.source).toEqual(sampleRoute.source);
        expect(rate.destination).toEqual(sampleRoute.destination);

        const amountIn = parseFloat(rate.amountIn);
        const amountOut = parseFloat(rate.amountOut);
        expect(amountIn, "Rate amountIn must be greater than 0").toBeGreaterThan(0);
        expect(amountOut, "Rate amountOut must be greater than 0").toBeGreaterThan(0);

        expect(rate.effectiveRate, "Effective rate should be positive").toBeGreaterThan(0);
        expect(rate.totalFeesUsd).toBeGreaterThanOrEqual(0);

        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        expect(new Date(rate.quotedAt).getTime()).toBeGreaterThan(oneHourAgo);
      });

      logTestSummary(result, "Rate Validation");
    });

    it("should validate liquidity depth when provided", async () => {
      const { client } = await runtime.usePlugin(TEST_PLUGIN_ID, TEST_CONFIG);

      const result = await client.getSnapshot({
        routes: [sampleRoute],
        notionals: ["1000"],
        includeWindows: ["24h"]
      })

      if (!result.liquidity || result.liquidity.length === 0) {
        throw new Error("❌ Expected liquidity to be present for routes. Implement getLiquidityDepth() in service.ts");
      }

      expect(result.liquidity.length).toBeGreaterThan(0);
      expect(result.liquidity[0]?.route).toEqual(sampleRoute);

      const thresholds = result.liquidity[0]?.thresholds;
      expect(thresholds, "Liquidity should include threshold data").toBeDefined();
      expect(thresholds!.length, "Should include at least 50bps and 100bps thresholds").toBeGreaterThanOrEqual(2);

      const threshold50 = thresholds?.find(t => t.slippageBps === 50);
      const threshold100 = thresholds?.find(t => t.slippageBps === 100);

      expect(threshold50, "Should include 50bps threshold").toBeDefined();
      expect(threshold100, "Should include 100bps threshold").toBeDefined();

      const amount50 = parseFloat(threshold50!.maxAmountIn);
      const amount100 = parseFloat(threshold100!.maxAmountIn);

      expect(amount50).toBeGreaterThan(0);
      expect(amount100).toBeGreaterThan(0);

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      expect(new Date(result.liquidity[0]!.measuredAt).getTime()).toBeGreaterThan(oneHourAgo);

      logTestSummary(result, "Liquidity Depth");
    });
  });
});
