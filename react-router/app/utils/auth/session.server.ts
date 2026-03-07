import crypto from "node:crypto";
import { createCookieSessionStorage, redirect } from "react-router";
import { env } from "~/utils/config/env.server";
import { prisma } from "~/utils/db/db.server";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [env.SESSION_SECRET],
    secure: env.NODE_ENV === "production",
    maxAge: env.SESSION_MAX_AGE / 1000,
  },
});

export function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

/**
 * Generate an HMAC-based fingerprint from stable browser headers.
 * Used to detect session hijacking (different browser/device reusing a stolen cookie).
 * Only uses User-Agent and Accept-Language — Client Hints (sec-ch-ua-*)
 * are excluded because they can differ between form POSTs, navigations,
 * and fetch requests, causing false-positive session invalidation.
 */
export function generateFingerprint(request: Request): string {
  const components = [
    request.headers.get("user-agent") || "",
    request.headers.get("accept-language") || "",
  ];
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(components.join("|")).digest("hex");
}

/**
 * Get the current user's ID from the session.
 * Now stores sessionId in cookie and validates against the DB Session record,
 * checking expiration and fingerprint on every request.
 */
export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request);
  const sessionId = session.get("sessionId");
  if (!sessionId || typeof sessionId !== "string") return null;

  const dbSession = await prisma.session.findFirst({
    where: { id: sessionId, expirationDate: { gt: new Date() } },
    select: { userId: true, fingerprint: true },
  });

  if (!dbSession) return null;

  // Validate fingerprint if one was stored (allow legacy sessions without fingerprint)
  if (dbSession.fingerprint) {
    const currentFingerprint = generateFingerprint(request);
    if (dbSession.fingerprint !== currentFingerprint) {
      // Session hijack detected — destroy the session
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
      await prisma.auditLog.create({
        data: {
          userId: dbSession.userId,
          action: "LOGOUT",
          entityType: "Session",
          entityId: sessionId,
          description: "Session invalidated: fingerprint mismatch (possible hijacking)",
          ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
      });
      return null;
    }
  }

  // If impersonating another user, return their ID instead
  const impersonatingUserId = session.get("impersonatingUserId");
  if (impersonatingUserId && typeof impersonatingUserId === "string") {
    return impersonatingUserId;
  }

  return dbSession.userId;
}

/**
 * Determine the default post-login redirect for a user.
 * Tenant users → /<slug>, global admins → /admin.
 */
export async function getDefaultRedirect(userId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { tenant: { select: { slug: true } } },
  });
  if (user?.tenant?.slug) {
    return `/${user.tenant.slug}`;
  }
  return "/admin";
}

export async function requireAnonymous(request: Request) {
  const userId = await getUserId(request);
  if (userId) {
    const redirectUrl = await getDefaultRedirect(userId);
    throw redirect(redirectUrl);
  }
}

export async function requireUserId(request: Request, redirectTo?: string): Promise<string> {
  const userId = await getUserId(request);
  if (!userId) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams([
      ["redirectTo", redirectTo ?? `${url.pathname}${url.search}`],
    ]);
    throw redirect(`/auth/login?${searchParams}`);
  }
  return userId;
}

const userCache = new WeakMap<Request, ReturnType<typeof fetchUser>>();

async function fetchUser(request: Request) {
  const userId = await requireUserId(request);
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      photoUrl: true,
      tenantId: true,
      userRoles: {
        select: {
          eventId: true,
          stepId: true,
          role: {
            select: {
              id: true,
              name: true,
              scope: true,
              rolePermissions: {
                select: {
                  access: true,
                  permission: { select: { resource: true, action: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!user) {
    throw await logout(request);
  }
  return user;
}

export function requireUser(request: Request) {
  const existing = userCache.get(request);
  if (existing) return existing;
  const promise = fetchUser(request);
  userCache.set(request, promise);
  return promise;
}

/**
 * Create a new DB-backed session with fingerprint, store sessionId in cookie.
 */
export async function createUserSession(request: Request, userId: string, redirectTo: string) {
  // Invalidate the old cookie session to prevent session fixation
  const oldSession = await getSession(request);
  const oldSessionId = oldSession.get("sessionId");
  if (oldSessionId && typeof oldSessionId === "string") {
    await prisma.session.delete({ where: { id: oldSessionId } }).catch(() => {});
  }

  // Delete all other existing sessions for this user (single-session enforcement)
  await prisma.session.deleteMany({ where: { userId } });

  const fingerprint = generateFingerprint(request);
  const dbSession = await prisma.session.create({
    data: {
      userId,
      expirationDate: new Date(Date.now() + env.SESSION_MAX_AGE),
      fingerprint,
    },
  });

  const session = await sessionStorage.getSession();
  session.set("sessionId", dbSession.id);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  // Clean up DB session if it exists
  const sessionId = session.get("sessionId");
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  return redirect("/auth/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

/**
 * Get the current impersonation state from the session cookie.
 */
export async function getImpersonationState(request: Request) {
  const session = await getSession(request);
  const impersonatingUserId = session.get("impersonatingUserId");
  const originalUserId = session.get("originalUserId");
  return {
    isImpersonating: !!impersonatingUserId,
    impersonatedUserId: impersonatingUserId as string | undefined,
    originalUserId: originalUserId as string | undefined,
  };
}

/**
 * Start impersonating a target user. Stores the admin's original user ID
 * and the target user ID in the cookie session.
 */
export async function startImpersonating(
  request: Request,
  targetUserId: string,
  redirectTo: string,
) {
  const session = await getSession(request);
  const sessionId = session.get("sessionId");

  const dbSession = await prisma.session.findFirst({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!dbSession) throw redirect("/auth/login");

  session.set("originalUserId", dbSession.userId);
  session.set("impersonatingUserId", targetUserId);

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

/**
 * Stop impersonating and restore the admin's original session.
 */
export async function stopImpersonating(request: Request, redirectTo: string) {
  const session = await getSession(request);
  session.unset("impersonatingUserId");
  session.unset("originalUserId");

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}
