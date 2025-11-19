import { Asset, Snapshot, TimeWindowEnum } from "@data-provider/shared-contract";
import type { RouterClient } from "@orpc/server";
import { os } from "@orpc/server";
import { z } from "every-plugin/zod";
import { plugins } from "../plugins";

export const router = {
	health: os
		.route({ method: "GET", path: "/health" })
		.handler(() => {
			return "OK";
		}),

	// Individual provider access
	providers: {
		across: os.prefix('/providers/across').router(plugins.across.router),
		// axelar: os.prefix('/providers/axelar').router(plugins.axelar.router),
		// cbridge: os.prefix('/providers/cbridge').router(plugins.cbridge.router),
		// cctp: os.prefix('/providers/cctp').router(plugins.cctp.router),
		// debridge: os.prefix('/providers/debridge').router(plugins.debridge.router),
		// layerzero: os.prefix('/providers/layerzero').router(plugins.layerzero.router),
		// lifi: os.prefix('/providers/lifi').router(plugins.lifi.router),
		nearIntents: os.prefix('/providers/near-intents').router(plugins.nearIntents.router),
		// wormhole: os.prefix('/providers/wormhole').router(plugins.wormhole.router),
	},

	// Aggregated snapshot with optional provider filter
	snapshot: os
		.route({ method: "POST", path: "/snapshot" })
		.input(z.object({
			providers: z.array(z.string()).optional(),
			routes: z.array(z.object({ source: Asset, destination: Asset })).optional(),
			notionals: z.array(z.string()).optional(),
			includeWindows: z.array(TimeWindowEnum).default(["24h"]).optional(),
		}))
		.output(z.record(z.string(), Snapshot))
		.handler(async ({ input }) => {
			const providerIds = input.providers || Object.keys(plugins);
			const activeProviders = providerIds.filter((id: string) => id in plugins);

			const results = await Promise.allSettled(
				activeProviders.map((id: string) =>
					plugins[id as keyof typeof plugins].client.getSnapshot({
						routes: input.routes,
						notionals: input.notionals,
						includeWindows: input.includeWindows,
					})
				)
			);

			const snapshots: Record<string, any> = {};
			results.forEach((result: PromiseSettledResult<any>, i: number) => {
				if (result.status === 'fulfilled') {
					snapshots[activeProviders[i]] = result.value;
				}
			});

			return snapshots;
		})
} as const;

export type AppRouter = typeof router;
export type AppRouterClient = RouterClient<AppRouter>;
