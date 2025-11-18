import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppRouterClient } from "@data-provider/api";
import { DevConfigManager } from "@/lib/dev-config";

export const SERVER_URL = `${process.env.NEXT_PUBLIC_SERVER_URL}/api/rpc` || "http://localhost:8787/api/rpc";

function getRpcUrl(): string {
	
	const config = DevConfigManager.getConfig();
	if (config?.enabled && config?.url) {
		return `${config.url}/api/rpc`;
	}
	return SERVER_URL;
}

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error) => {
			toast.error(`Error: ${error.message}`, {
				action: {
					label: "retry",
					onClick: () => {
						queryClient.invalidateQueries();
					},
				},
			});
		},
	}),
});

export const link = new RPCLink({
	url: getRpcUrl,
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
