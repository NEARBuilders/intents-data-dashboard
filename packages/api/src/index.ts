import { os } from "@orpc/server";
import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

export { createContext } from "./context";
export type { Context };

export { initializePlugins, type Plugins } from './plugins';
export { createRouter, type AppRouter, type AppRouterClient } from './routers';
