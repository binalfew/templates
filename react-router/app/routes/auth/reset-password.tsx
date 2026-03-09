import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import { hashPassword } from "~/utils/auth/auth.server";
import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";
import { requireAnonymous } from "~/utils/auth/session.server";
import { resetPasswordSchema } from "~/utils/schemas/password-reset";
import { isCodeValid } from "~/utils/auth/verification.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AuthContent } from "~/components/auth/auth-layout";
import { Lock, AlertTriangle } from "lucide-react";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/reset-password";

export const meta: Route.MetaFunction = () => buildMeta("Reset Password", "Set a new password");

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    throw redirect("/auth/login");
  }

  // Validate token without deleting it (will delete on password reset)
  const valid = await isCodeValid({
    code: token,
    type: "password-reset",
    target: email,
    deleteOnSuccess: false,
  });

  if (!valid) {
    return { valid: false, email, token };
  }

  return { valid: true, email, token };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: resetPasswordSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { token, email, password } = submission.value;

  // Validate and consume the token
  const valid = await isCodeValid({
    code: token,
    type: "password-reset",
    target: email,
    deleteOnSuccess: true,
  });

  if (!valid) {
    return data(
      submission.reply({
        formErrors: ["Invalid or expired reset link. Please request a new one."],
      }),
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return data(submission.reply({ formErrors: ["Account not found."] }), { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.password.upsert({
    where: { userId: user.id },
    update: { hash: passwordHash },
    create: { userId: user.id, hash: passwordHash },
  });

  logger.info({ userId: user.id }, "Password reset successfully");

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      tenantId: user.tenantId,
      action: "UPDATE",
      entityType: "Password",
      entityId: user.id,
      description: "Password reset via email",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  throw redirect("/auth/login?reset=success");
}

export default function ResetPasswordPage({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("auth");
  const { valid, email, token } = loaderData;

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: resetPasswordSchema });
    },
    shouldRevalidate: "onBlur",
  });

  if (!valid) {
    return (
      <AuthContent>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("linkExpiredTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("linkExpiredDesc")}</p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
        </div>

        <Link to="/auth/forgot-password">
          <Button
            className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25"
            size="lg"
          >
            {t("requestNewLink")}
          </Button>
        </Link>
      </AuthContent>
    );
  }

  return (
    <AuthContent>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("resetPasswordTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("resetPasswordSubtitle")}</p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="email" value={email} />

        {form.errors && form.errors.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 animate-[shake_0.5s_ease-in-out]">
            <p className="text-sm text-destructive">{form.errors[0]}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={fields.password.id} className="text-sm font-medium">
            {t("newPassword")}
          </Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            {(() => {
              const { key, ...props } = getInputProps(fields.password, { type: "password" });
              return (
                <Input
                  key={key}
                  {...props}
                  autoComplete="new-password"
                  autoFocus
                  className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                />
              );
            })()}
          </div>
          {fields.password.errors && (
            <p className="text-sm text-destructive">{fields.password.errors[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.confirmPassword.id} className="text-sm font-medium">
            {t("confirmPassword")}
          </Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            {(() => {
              const { key, ...props } = getInputProps(fields.confirmPassword, {
                type: "password",
              });
              return (
                <Input
                  key={key}
                  {...props}
                  autoComplete="new-password"
                  className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                />
              );
            })()}
          </div>
          {fields.confirmPassword.errors && (
            <p className="text-sm text-destructive">{fields.confirmPassword.errors[0]}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
          size="lg"
        >
          {t("resetPassword")}
        </Button>
      </Form>
    </AuthContent>
  );
}
