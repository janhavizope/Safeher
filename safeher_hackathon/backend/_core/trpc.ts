import {
  DEVICE_AUTH_ERR_MSG,
  DEVICE_COOKIE_NAME,
  NOT_ADMIN_ERR_MSG,
  ONE_YEAR_MS,
  UNAUTHED_ERR_MSG,
} from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getSessionCookieOptions } from "./cookies";
import type { TrpcContext } from "./context";
import { sdk } from "./sdk";
import { getClientDeviceId, hashIdentifier } from "../security";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
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

const requireTrustedDevice = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const deviceId = getClientDeviceId(ctx.req);
  if (!deviceId) {
    throw new TRPCError({ code: "FORBIDDEN", message: DEVICE_AUTH_ERR_MSG });
  }

  const cookies = parseCookieHeader(ctx.req.headers.cookie ?? "");
  const cookieDeviceToken = cookies[DEVICE_COOKIE_NAME];
  const headerDeviceHash = hashIdentifier(deviceId);
  const cookiePayload = await sdk.verifyDeviceToken(cookieDeviceToken);

  // First request from this device: issue a signed device cookie and continue.
  if (!cookiePayload) {
    if (typeof ctx.res.cookie !== "function") {
      return next();
    }

    const token = await sdk.createDeviceToken(ctx.user.openId, headerDeviceHash);
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(DEVICE_COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });
    return next();
  }

  const hasMismatchedUser = cookiePayload.openId !== ctx.user.openId;
  const hasMismatchedDevice = cookiePayload.deviceHash !== headerDeviceHash;

  if (hasMismatchedUser || hasMismatchedDevice) {
    throw new TRPCError({ code: "FORBIDDEN", message: DEVICE_AUTH_ERR_MSG });
  }

  return next();
});

export const protectedProcedure = t.procedure.use(requireUser).use(requireTrustedDevice);

export const adminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
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
