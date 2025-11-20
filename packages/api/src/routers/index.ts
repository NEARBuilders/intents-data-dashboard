import type { RouterClient } from "@orpc/server";
import { os } from "@orpc/server";
import type { Plugins } from "../plugins";

export function createRouter(plugins: Plugins) {
	return {
		health: os
			.route({ method: "GET", path: "/health" })
			.handler(() => {
				return "OK";
			}),
			// @ts-ignore
		...plugins.aggregator.router
	} as const;
}

export type AppRouter = ReturnType<typeof createRouter>;
export type AppRouterClient = RouterClient<AppRouter>;
