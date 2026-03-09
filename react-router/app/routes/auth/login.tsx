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
import { Checkbox } from "~/components/ui/checkbox";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Shield, Zap, Globe, Users, CheckCircle2 } from "lucide-react";
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
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-[0.07]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" className="text-primary-foreground" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Animated floating shapes */}
        <div className="absolute top-20 left-16 size-72 rounded-full bg-primary-foreground/[0.06] blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-24 right-12 size-56 rounded-full bg-primary-foreground/[0.06] blur-3xl animate-[pulse_10s_ease-in-out_infinite_1s]" />
        <div className="absolute top-1/3 right-1/3 size-40 rounded-full bg-primary-foreground/[0.04] blur-2xl animate-[pulse_12s_ease-in-out_infinite_2s]" />

        {/* Decorative ring */}
        <div className="absolute -bottom-32 -left-32 size-96 rounded-full border border-primary-foreground/[0.08]" />
        <div className="absolute -top-24 -right-24 size-72 rounded-full border border-primary-foreground/[0.06]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm shadow-lg shadow-black/10">
              <Shield className="size-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">Admin Platform</span>
              <p className="text-[11px] text-primary-foreground/50 tracking-widest uppercase">Enterprise Suite</p>
            </div>
          </div>

          {/* Center content — testimonial */}
          <div className="max-w-lg space-y-10">
            {/* Large quote */}
            <div className="space-y-6">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="size-5 fill-amber-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="space-y-4">
                <p className="text-[1.7rem] font-semibold leading-snug tracking-tight">
                  "Streamlined our operations across 12 offices. The multi-tenant architecture is exactly what we needed."
                </p>
                <footer className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-bold">
                    JD
                  </div>
                  <div>
                    <p className="text-sm font-medium">Jane Doe</p>
                    <p className="text-xs text-primary-foreground/60">CTO, Acme Corp</p>
                  </div>
                </footer>
              </blockquote>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: Shield, label: "Enterprise Security" },
                { icon: Zap, label: "Real-time Sync" },
                { icon: Globe, label: "Multi-language" },
                { icon: Users, label: "Team Management" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 text-sm backdrop-blur-sm"
                >
                  <Icon className="size-3.5" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats + footer */}
          <div className="space-y-6">
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-bold">10k+</p>
                <p className="text-xs text-primary-foreground/50">Active users</p>
              </div>
              <div className="h-10 w-px bg-primary-foreground/10" />
              <div>
                <p className="text-2xl font-bold">99.9%</p>
                <p className="text-xs text-primary-foreground/50">Uptime</p>
              </div>
              <div className="h-10 w-px bg-primary-foreground/10" />
              <div>
                <p className="text-2xl font-bold">50+</p>
                <p className="text-xs text-primary-foreground/50">Organizations</p>
              </div>
            </div>
            <p className="text-xs text-primary-foreground/30">
              &copy; {new Date().getFullYear()} Admin Platform. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full flex-col justify-center bg-background px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Shield className="size-6" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">Admin Platform</span>
            <p className="text-[11px] text-muted-foreground tracking-widest uppercase">Enterprise Suite</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm animate-[fadeIn_0.5s_ease-out]">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t("loginTitle")}
            </h1>
            <p className="mt-2 text-muted-foreground">{t("loginSubtitle")}</p>
          </div>

          <Form method="post" {...getFormProps(form)} className="space-y-5">
            {form.errors && form.errors.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 animate-[fadeIn_0.3s_ease-out]">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                  <Lock className="size-4 text-destructive" />
                </div>
                <p className="text-sm text-destructive">{form.errors[0]}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={fields.email.id} className="text-sm font-medium">
                {t("email")}
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                {(() => {
                  const { key, ...emailProps } = getInputProps(fields.email, { type: "email" });
                  return (
                    <Input
                      key={key}
                      {...emailProps}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
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
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                {(() => {
                  const { key, ...passwordProps } = getInputProps(fields.password, {
                    type: showPassword ? "text" : "password",
                  });
                  return (
                    <Input
                      key={key}
                      {...passwordProps}
                      autoComplete="current-password"
                      className="h-11 pl-10 pr-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
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

            <div className="flex items-center gap-2">
              <Checkbox id="remember" />
              <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">
                {t("rememberMe")}
              </label>
            </div>

            <input type="hidden" name="redirectTo" value="" />

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
              size="lg"
              disabled={isSubmitting}
            >
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

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">or</span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              to="/auth/signup"
              className="font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {t("signUp")}
            </Link>
          </p>

          {/* Trust signals */}
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 text-muted-foreground/50">
              <div className="flex items-center gap-1.5 text-xs">
                <Shield className="size-3" />
                <span>SSL Secured</span>
              </div>
              <div className="size-1 rounded-full bg-muted-foreground/20" />
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="size-3" />
                <span>SOC 2 Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
