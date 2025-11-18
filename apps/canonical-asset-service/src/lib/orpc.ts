import { ORPCError, os } from "@orpc/server";

export interface Context {
  isAdmin: boolean;
}

export const o = os.$context<Context>();

export const publicProcedure = o;

// Middleware to require admin API key
const requireAdmin = o.middleware(async ({ context, next }) => {
  if (!context.isAdmin) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Admin access required"
    });
  }
  return next({
    context: {
      isAdmin: true,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAdmin);
