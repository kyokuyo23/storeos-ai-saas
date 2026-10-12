import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

/** Raw driver/ORM errors (e.g. drizzle "Failed query: select ... params: ...") must never reach clients. */
export function isRawInternalError(cause: unknown) {
  if (!cause || typeof cause !== "object" || cause instanceof TRPCError) return false;
  const candidate = cause as { message?: string; code?: unknown; sqlMessage?: unknown; cause?: unknown };
  return Boolean(
    candidate.message?.startsWith("Failed query")
    || candidate.sqlMessage
    || (typeof candidate.code === "string" && candidate.code.startsWith("ER_"))
    || (candidate.cause && typeof candidate.cause === "object" && ((candidate.cause as { sqlMessage?: unknown }).sqlMessage || typeof (candidate.cause as { code?: unknown }).code === "string")),
  );
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.code === "INTERNAL_SERVER_ERROR" && isRawInternalError(error.cause)) {
      console.error("[tRPC] internal error", error.cause);
      return { ...shape, message: "Terjadi kesalahan server. Silakan coba lagi.", data: { ...shape.data, stack: undefined } };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
