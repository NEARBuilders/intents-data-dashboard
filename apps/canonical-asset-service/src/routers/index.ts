import { publicProcedure, protectedProcedure } from "../lib/orpc";
import type { RouterClient } from "@orpc/server";
import { plugins } from "../plugins";

export const router = publicProcedure.router({
  health: publicProcedure.handler(() => ({
    status: 'ok',
    service: 'canonical-asset-service',
    timestamp: new Date().toISOString()
  })),

  canonical: {
    // Public routes - no auth required
    ...plugins.canonicalAsset.router,

    // Protected admin route - requires API key
    ...protectedProcedure.router({
      sync: plugins.canonicalAsset.router.sync
    })
  }
});

export type AppRouter = typeof router;
export type AppRouterClient = RouterClient<AppRouter>;
