import Plugin from "@/index";
import pluginDevConfig, { sampleRoute, testRoutes, testNotionals } from "../../plugin.dev";
import type { PluginRegistry } from "every-plugin";
import { createLocalPluginRuntime } from "every-plugin/testing";
import { beforeAll, describe, expect, it } from "vitest";

const TEST_PLUGIN_ID = pluginDevConfig.pluginId;
const TEST_CONFIG = pluginDevConfig.config;

const TEST_REGISTRY: PluginRegistry = {
  [TEST_PLUGIN_ID]: {
    remoteUrl: "http://localhost:3000/remoteEntry.js",
    version: "1.0.0",
    description: "Data provider template for integration testing",
  },
};

const TEST_PLUGIN_MAP = {
  [TEST_PLUGIN_ID]: Plugin,
} as const;

describe("Data Provider Plugin Integration Tests", () => {
  const runtime = createLocalPluginRuntime<typeof TEST_PLUGIN_MAP>(
    {
      registry: TEST_REGISTRY,
      secrets: { },
    },
    TEST_PLUGIN_MAP
  );

  beforeAll(async () => {
    const { initialized } = await runtime.usePlugin(TEST_PLUGIN_ID, TEST_CONFIG);
    expect(initialized).toBeDefined();
    expect(initialized.plugin.id).toBe(TEST_PLUGIN_ID);
  });

  describe("getSnapshot procedure", () => {
    it("should handle multiple routes correctly", async () => {
      const { client } = await runtime.usePlugin(TEST_PLUGIN_ID, TEST_CONFIG);

      const result = await client.getSnapshot({
        routes: testRoutes,
        notionals: testNotionals,
        includeWindows: ["24h"]
      });

      if (!result.liquidity || !result.rates) {
        throw new Error("❌ Expected liquidity and rates to be present for multiple routes. Ensure getRates() and getLiquidityDepth() handle multiple routes correctly.");
      }

      expect(result.liquidity.length, "Should return liquidity for each route").toBe(1);
      expect(result.rates.length, "Should return rates for each route").toBe(1); // 1 route × 1 notional
    });


  });

  describe("ping procedure", () => {
    it("[SANITY CHECK] should return healthy status", async () => {
      const { client } = await runtime.usePlugin(TEST_PLUGIN_ID, TEST_CONFIG);

      const result = await client.ping();

      expect(result.status).toBe("ok");
    });
  });
});
