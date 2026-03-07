import { generateTOTP, verifyTOTP } from "@epic-web/totp";
import { createCookieSessionStorage, redirect } from "react-router";
import { prisma } from "~/utils/db/db.server";
import { env } from "~/utils/config/env.server";
import { sessionStorage, getSession, generateFingerprint } from "~/utils/auth/session.server";
import {
  twoFAVerificationType,
  unverifiedSessionIdKey,
  verifiedTimeKey,
} from "~/utils/auth/2fa-constants";

// ─── Verify Session Storage ─────────────────────────────

export const verifySessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__verification",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [env.SESSION_SECRET],
    secure: env.NODE_ENV === "production",
    maxAge: 10 * 60,
  },
});

export function getVerifySession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return verifySessionStorage.getSession(cookie);
}

export function commitVerifySession(session: Awaited<ReturnType<typeof getVerifySession>>) {
  return verifySessionStorage.commitSession(session);
}

export function destroyVerifySession(session: Awaited<ReturnType<typeof getVerifySession>>) {
  return verifySessionStorage.destroySession(session);
}

// ─── OTP Generation & Validation ─────────────────────────

export async function prepareVerification({
  type,
  target,
  userId,
  period = 10 * 60,
}: {
  type: string;
  target: string;
  userId?: string;
  period?: number;
}) {
  const {
    otp,
    secret,
    algorithm,
    period: totpPeriod,
    digits,
    charSet,
  } = await generateTOTP({ period, algorithm: "SHA-256" });

  const expiresAt = new Date(Date.now() + period * 1000);

  await prisma.verification.upsert({
    where: { target_type: { target, type } },
    update: {
      secret,
      algorithm,
      digits,
      period: totpPeriod,
      charSet,
      expiresAt,
      ...(userId !== undefined && { userId }),
    },
    create: {
      type,
      target,
      secret,
      algorithm,
      digits,
      period: totpPeriod,
      charSet,
      expiresAt,
      ...(userId !== undefined && { userId }),
    },
  });

  return { otp };
}

export async function isCodeValid({
  code,
  type,
  target,
  deleteOnSuccess = true,
}: {
  code: string;
  type: string;
  target: string;
  deleteOnSuccess?: boolean;
}) {
  const verification = await prisma.verification.findUnique({
    where: { target_type: { target, type } },
  });
  if (!verification) return false;
  if (verification.expiresAt && verification.expiresAt < new Date()) return false;

  const result = await verifyTOTP({
    otp: code,
    secret: verification.secret,
    algorithm: verification.algorithm,
    digits: verification.digits,
    period: verification.period,
    charSet: verification.charSet,
  });

  if (!result) return false;

  if (deleteOnSuccess) {
    await prisma.verification.delete({ where: { id: verification.id } });
  }
  return true;
}

// ─── 2FA Helpers ─────────────────────────────────────────

export async function shouldRequestTwoFA({
  request,
  userId,
}: {
  request: Request;
  userId: string;
}) {
  const verifySession = await getVerifySession(request);
  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey);
  if (unverifiedSessionId) return true;

  const verification = await prisma.verification.findUnique({
    select: { id: true },
    where: {
      target_type: {
        target: userId,
        type: twoFAVerificationType,
      },
    },
  });

  if (!verification) return false;

  const cookieSession = await getSession(request);
  const verifiedTime = new Date(cookieSession.get(verifiedTimeKey) ?? 0);
  const twoHoursMs = 2 * 60 * 60 * 1000;

  return Date.now() - verifiedTime.getTime() > twoHoursMs;
}

export async function handleTwoFAVerification({
  request,
  redirectTo,
}: {
  request: Request;
  redirectTo: string;
}) {
  const cookieSession = await sessionStorage.getSession(request.headers.get("Cookie"));
  const verifySession = await getVerifySession(request);

  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey);
  if (!unverifiedSessionId) {
    throw redirect("/auth/login");
  }

  const dbSession = await prisma.session.findUnique({
    where: { id: unverifiedSessionId },
    select: { expirationDate: true },
  });

  if (!dbSession) {
    throw redirect("/auth/login");
  }

  cookieSession.set(verifiedTimeKey, Date.now());
  cookieSession.set("sessionId", unverifiedSessionId);

  const headers = new Headers();
  headers.append("Set-Cookie", await sessionStorage.commitSession(cookieSession));
  headers.append("Set-Cookie", await verifySessionStorage.destroySession(verifySession));

  return redirect(redirectTo || "/", { headers });
}

export async function requireOnboardingEmail(request: Request): Promise<string> {
  const verifySession = await getVerifySession(request);
  const email = verifySession.get("onboardingEmail");
  if (!email || typeof email !== "string") {
    throw redirect("/auth/signup");
  }
  return email;
}
