import type { AppRouterClient } from "@data-provider/api";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import { onError } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { toast } from "sonner";

export const SERVER_URL = `${process.env.VITE_SERVER_URL ?? "http://localhost:8787"}/api/rpc`;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
  defaultOptions: { queries: { staleTime: 60 * 1000 } },
});

/**
 * This creates an isomorphic oRPC client that works correctly in both
 * SSR (server-side rendering) and client-side environments.
 */
const getORPCClient = createIsomorphicFn()
  .server(() => {
    // Server-side: Use full server URL and forward headers/cookies
    const link = new RPCLink({
      url: SERVER_URL,
      headers: () => getRequestHeaders(), // Forward request headers
      interceptors: [
        onError((error) => {
          console.error("oRPC Server Error:", error);
          throw error;
        }),
      ],
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    });

    return createORPCClient(link);
  })
  .client(() => {
    // Client-side: Use browser relative URL with cookies
    const link = new RPCLink({
      url: SERVER_URL,
      plugins: [
        new BatchLinkPlugin({
          // Batch requests to reduce network overhead
          exclude: ({ path }) => path[0] === 'sse', // Don't batch SSE calls
          groups: [{
            condition: () => true,
            context: {},
          }],
        }),
      ],
      interceptors: [
        onError((error) => {
          console.error("oRPC Client Error:", error);
        }),
      ],
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    });

    return createORPCClient(link);
  });

export const client: AppRouterClient = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
