import type { RouterClient } from "@orpc/server";
import { os } from "@orpc/server";
import { Plugins } from "../plugins";

export function createRouter(plugins: Plugins) {
	return {
		health: os
			.route({ method: "GET", path: "/health" })
			.handler(() => {
				return "OK";
			}),
		...plugins.canonical.router
	} as const;
}

export type AppRouter = ReturnType<typeof createRouter>;
export type AppRouterClient = RouterClient<AppRouter>;
