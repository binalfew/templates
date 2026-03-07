import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useActionData } from "react-router";
import { useTranslation } from "react-i18next";
import { twoFAVerificationType, unverifiedSessionIdKey } from "~/utils/auth/2fa-constants";
import { verifyPassword } from "~/utils/auth/auth.server";
import { prisma } from "~/utils/db/db.server";
import { env } from "~/utils/config/env.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { logger } from "~/utils/monitoring/logger.server";
import { getUserId, getDefaultRedirect, createUserSession, generateFingerprint } from "~/utils/auth/session.server";
import { verifySessionStorage } from "~/utils/auth/verification.server";
import { isUserRequired2FA, hasUserSetUp2FA } from "~/services/two-factor.server";
import { loginSchema } from "~/utils/schemas/auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => buildMeta("Log In", "Sign in to your account");

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) {
    const redirectUrl = await getDefaultRedirect(userId);
    throw redirect(redirectUrl);
  }
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: loginSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { email, password, redirectTo } = submission.value;

  const user = await prisma.user.findFirst({
    where: { email },
    include: { password: true, tenant: { select: { slug: true } } },
  });

  if (!user || !user.password) {
    logger.info({ email }, "Login failed: user not found");
    await prisma.auditLog.create({
      data: {
        action: "LOGIN",
        entityType: "User",
        description: "Login failed — invalid credentials",
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
        metadata: { email, reason: "not_found" },
      },
    });
    return data(submission.reply({ formErrors: ["Invalid email or password"] }), { status: 400 });
  }

  // Check lockout
  if (user.status === "LOCKED") {
    if (user.autoUnlockAt && user.autoUnlockAt <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          failedLoginAttempts: 0,
          lockedAt: null,
          lockReason: null,
          autoUnlockAt: null,
        },
      });
    } else {
      logger.info({ userId: user.id }, "Login failed: account locked");
      return data(
        submission.reply({
          formErrors: ["Account is locked. Please try again later or contact an administrator."],
        }),
        { status: 403 },
      );
    }
  }

  // Check inactive/suspended
  if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
    return data(
      submission.reply({
        formErrors: ["Your account is not active. Please contact an administrator."],
      }),
      { status: 403 },
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password.hash);
  if (!isValid) {
    const { newAttempts, shouldLock } = await prisma.$transaction(async (tx) => {
      const freshUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const attempts = freshUser.failedLoginAttempts + 1;
      const lock = attempts >= env.MAX_LOGIN_ATTEMPTS;
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lastFailedLoginAt: new Date(),
          ...(lock && {
            status: "LOCKED",
            lockedAt: new Date(),
            lockReason: "Too many failed login attempts",
            lockCount: { increment: 1 },
            autoUnlockAt: new Date(Date.now() + env.LOCKOUT_DURATION_MINUTES * 60 * 1000),
          }),
        },
      });
      return { newAttempts: attempts, shouldLock: lock };
    });

    logger.info({ userId: user.id, attempts: newAttempts }, "Login failed: wrong password");
    return data(submission.reply({ formErrors: ["Invalid email or password"] }), { status: 400 });
  }

  // Success — reset failed attempts
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lastFailedLoginAt: null },
  });

  const defaultRedirect = user.tenant?.slug ? `/${user.tenant.slug}` : "/admin";
  const finalRedirect = redirectTo || defaultRedirect;

  logger.info({ userId: user.id }, "Login successful");
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      tenantId: user.tenantId,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      description: "Login successful",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  // Check if 2FA is enabled for this user (only when FF is on)
  const twoFAFlagEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR);
  if (twoFAFlagEnabled) {
    const twoFAVerification = await prisma.verification.findUnique({
      select: { id: true },
      where: { target_type: { target: user.id, type: twoFAVerificationType } },
    });

    if (twoFAVerification) {
      // Create an unverified session and redirect to 2FA verify
      const fingerprint = generateFingerprint(request);
      const dbSession = await prisma.session.create({
        data: {
          userId: user.id,
          expirationDate: new Date(Date.now() + env.SESSION_MAX_AGE),
          fingerprint,
        },
      });

      const verifySession = await verifySessionStorage.getSession();
      verifySession.set(unverifiedSessionIdKey, dbSession.id);
      verifySession.set("redirectTo", finalRedirect);

      return redirect("/auth/2fa-verify", {
        headers: {
          "Set-Cookie": await verifySessionStorage.commitSession(verifySession),
        },
      });
    }

    // Check if 2FA is enforced but user hasn't set it up yet
    if (user.tenantId) {
      const required = await isUserRequired2FA(user.id, user.tenantId);
      const hasSetUp = await hasUserSetUp2FA(user.id);
      if (required && !hasSetUp) {
        const fingerprint = generateFingerprint(request);
        const dbSession = await prisma.session.create({
          data: {
            userId: user.id,
            expirationDate: new Date(Date.now() + env.SESSION_MAX_AGE),
            fingerprint,
          },
        });

        const verifySession = await verifySessionStorage.getSession();
        verifySession.set(unverifiedSessionIdKey, dbSession.id);
        verifySession.set("redirectTo", finalRedirect);

        logger.info({ userId: user.id }, "Login successful — redirecting to forced 2FA setup");
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId,
            action: "LOGIN",
            entityType: "User",
            entityId: user.id,
            description: "Login successful — redirecting to forced 2FA setup",
            ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
            metadata: { twoFactorEnforced: true },
          },
        });

        return redirect("/auth/2fa-setup", {
          headers: {
            "Set-Cookie": await verifySessionStorage.commitSession(verifySession),
          },
        });
      }
    }
  }

  return createUserSession(request, user.id, finalRedirect);
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation("auth");
  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: loginSchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
              <CardDescription>{t("loginSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" {...getFormProps(form)}>
                <div className="flex flex-col gap-6">
                  {form.errors && form.errors.length > 0 && (
                    <div className="rounded-md bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">{form.errors[0]}</p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor={fields.email.id}>{t("email")}</Label>
                    {(() => {
                      const { key, ...emailProps } = getInputProps(fields.email, {
                        type: "email",
                      });
                      return (
                        <Input
                          key={key}
                          {...emailProps}
                          placeholder="m@example.com"
                          autoComplete="email"
                        />
                      );
                    })()}
                    {fields.email.errors && (
                      <p className="text-sm text-destructive">{fields.email.errors[0]}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={fields.password.id}>{t("password")}</Label>
                    {(() => {
                      const { key, ...passwordProps } = getInputProps(fields.password, {
                        type: "password",
                      });
                      return <Input key={key} {...passwordProps} autoComplete="current-password" />;
                    })()}
                    {fields.password.errors && (
                      <p className="text-sm text-destructive">{fields.password.errors[0]}</p>
                    )}
                  </div>

                  <input type="hidden" name="redirectTo" value="" />

                  <Button type="submit" className="w-full">
                    {t("login")}
                  </Button>

                  <div className="text-center text-sm">
                    <Link
                      to="/auth/forgot-password"
                      className="underline underline-offset-4"
                    >
                      {t("forgotPassword")}
                    </Link>
                  </div>

                  <div className="text-center text-sm">
                    {t("noAccount")}{" "}
                    <Link to="/auth/signup" className="underline underline-offset-4">
                      {t("signUp")}
                    </Link>
                  </div>
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
