import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { twoFAVerificationType, unverifiedSessionIdKey } from "~/utils/auth/2fa-constants";
import { verifyPassword } from "~/utils/auth/auth.server";
import { prisma } from "~/utils/db/db.server";
import { env } from "~/utils/config/env.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { logger } from "~/utils/monitoring/logger.server";
import {
  getUserId,
  getDefaultRedirect,
  createUserSession,
  generateFingerprint,
} from "~/utils/auth/session.server";
import { verifySessionStorage } from "~/utils/auth/verification.server";
import { isUserRequired2FA, hasUserSetUp2FA } from "~/services/two-factor.server";
import { loginSchema } from "~/utils/schemas/auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Shield, Zap, Globe } from "lucide-react";
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: loginSchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="flex min-h-svh">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary-foreground" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Floating shapes */}
        <div className="absolute top-20 left-16 size-64 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute bottom-32 right-20 size-48 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 size-32 rounded-full bg-primary-foreground/5 blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
                <Shield className="size-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">Admin Platform</span>
            </div>
          </div>

          {/* Testimonial / value prop */}
          <div className="max-w-md space-y-8">
            <blockquote className="space-y-4">
              <p className="text-2xl font-semibold leading-snug">
                "The platform that brings your entire team together with powerful tools and seamless collaboration."
              </p>
              <footer className="text-sm text-primary-foreground/70">
                — Built for modern organizations
              </footer>
            </blockquote>

            <div className="grid grid-cols-3 gap-6 pt-4">
              <div className="space-y-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Shield className="size-5" />
                </div>
                <p className="text-sm font-medium">Secure</p>
                <p className="text-xs text-primary-foreground/60">Enterprise-grade security with 2FA</p>
              </div>
              <div className="space-y-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Zap className="size-5" />
                </div>
                <p className="text-sm font-medium">Fast</p>
                <p className="text-xs text-primary-foreground/60">Lightning-fast performance</p>
              </div>
              <div className="space-y-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <Globe className="size-5" />
                </div>
                <p className="text-sm font-medium">Global</p>
                <p className="text-xs text-primary-foreground/60">Multi-tenant, multi-language</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-primary-foreground/40">
            &copy; {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shield className="size-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Admin Platform</span>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t("loginTitle")}
            </h1>
            <p className="mt-2 text-muted-foreground">{t("loginSubtitle")}</p>
          </div>

          <Form method="post" {...getFormProps(form)} className="space-y-5">
            {form.errors && form.errors.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/20">
                  <Lock className="size-4 text-destructive" />
                </div>
                <p className="text-sm text-destructive">{form.errors[0]}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={fields.email.id} className="text-sm font-medium">
                {t("email")}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                {(() => {
                  const { key, ...emailProps } = getInputProps(fields.email, { type: "email" });
                  return (
                    <Input
                      key={key}
                      {...emailProps}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="pl-10"
                    />
                  );
                })()}
              </div>
              {fields.email.errors && (
                <p className="text-sm text-destructive">{fields.email.errors[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={fields.password.id} className="text-sm font-medium">
                  {t("password")}
                </Label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                {(() => {
                  const { key, ...passwordProps } = getInputProps(fields.password, {
                    type: showPassword ? "text" : "password",
                  });
                  return (
                    <Input
                      key={key}
                      {...passwordProps}
                      autoComplete="current-password"
                      className="pl-10 pr-10"
                    />
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {fields.password.errors && (
                <p className="text-sm text-destructive">{fields.password.errors[0]}</p>
              )}
            </div>

            <input type="hidden" name="redirectTo" value="" />

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t("login")}
                  <ArrowRight className="size-4" />
                </span>
              )}
            </Button>
          </Form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              to="/auth/signup"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {t("signUp")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
