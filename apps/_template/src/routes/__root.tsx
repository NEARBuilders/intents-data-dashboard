import { ThemeProvider } from "../lib/providers/theme";
import { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { Toaster } from "sonner";
import React from "react";
import type { orpc, queryClient } from "../utils/orpc";

export const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

export const ReactQueryDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/react-query-devtools").then((d) => ({
          default: d.ReactQueryDevtools,
        })),
      );

export const Route = createRootRouteWithContext<{
  orpc: typeof orpc;
  queryClient: typeof queryClient;
}>()({
  component: RootComponent,
  notFoundComponent: () => <>Not found</>,
});

function RootComponent() {
  return (
    <>
      {/* <AuthDebugger /> */}
      <ThemeProvider defaultTheme="light" storageKey="profile-ui-theme">
        {/* May not need Near Provider, and Jazz Provider maybe should be combined */}
        <Outlet />
        <React.Suspense>
          <TanStackRouterDevtools position="bottom-left" />
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </React.Suspense>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </>
  );
}
