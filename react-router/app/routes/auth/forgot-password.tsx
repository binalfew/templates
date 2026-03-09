import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { prisma } from "~/utils/db/db.server";
import { sendEmail } from "~/utils/email/email.server";
import { passwordResetEmail } from "~/utils/email/email-templates.server";
import { env } from "~/utils/config/env.server";
import { logger } from "~/utils/monitoring/logger.server";
import { requireAnonymous } from "~/utils/auth/session.server";
import { forgotPasswordSchema } from "~/utils/schemas/password-reset";
import { prepareVerification } from "~/utils/auth/verification.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AuthContent } from "~/components/auth/auth-layout";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/forgot-password";

export const meta: Route.MetaFunction = () => buildMeta("Forgot Password", "Reset your password");

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: forgotPasswordSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { email } = submission.value;

  // Always return success to prevent email enumeration
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) {
    const { otp } = await prepareVerification({
      type: "password-reset",
      target: email,
      userId: user.id,
      period: 60 * 60, // 1 hour
    });

    const template = passwordResetEmail(otp, email);
    await sendEmail({ to: email, ...template }).catch((err) => {
      logger.error({ email, err }, "Failed to send password reset email");
    });

    if (env.NODE_ENV === "development") {
      const resetUrl = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(otp)}&email=${encodeURIComponent(email)}`;
      logger.info({ email, resetUrl }, "Password reset link (dev)");
    } else {
      logger.info({ email }, "Password reset email sent");
    }
  }

  return data({ sent: true });
}

export default function ForgotPasswordPage({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation("auth");
  const sent = actionData && "sent" in actionData && actionData.sent;

  const [form, fields] = useForm({
    lastResult: sent ? undefined : (actionData as any),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: forgotPasswordSchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <AuthContent>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("forgotPasswordTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {sent ? t("forgotPasswordSubtitleSent") : t("forgotPasswordSubtitleDefault")}
        </p>
      </div>

      {sent ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
            <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {t("forgotPasswordSentMessage")}
            </p>
          </div>
          <Link to="/auth/login">
            <Button
              variant="outline"
              className="w-full h-11 text-base font-medium"
              size="lg"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft className="size-4" />
                {t("backToLogin")}
              </span>
            </Button>
          </Link>
        </div>
      ) : (
        <Form method="post" {...getFormProps(form)} className="space-y-5">
          {form.errors && form.errors.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 animate-[shake_0.5s_ease-in-out]">
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
                const { key, ...emailProps } = getInputProps(fields.email, {
                  type: "email",
                });
                return (
                  <Input
                    key={key}
                    {...emailProps}
                    placeholder="you@company.com"
                    autoComplete="email"
                    autoFocus
                    className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                  />
                );
              })()}
            </div>
            {fields.email.errors && (
              <p className="text-sm text-destructive">{fields.email.errors[0]}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
            size="lg"
          >
            {t("sendResetLink")}
          </Button>

          <div className="text-center">
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              {t("backToLogin")}
            </Link>
          </div>
        </Form>
      )}
    </AuthContent>
  );
}
