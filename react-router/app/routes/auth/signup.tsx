import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import { prisma } from "~/utils/db/db.server";
import { sendEmail } from "~/utils/email/email.server";
import { otpEmail } from "~/utils/email/email-templates.server";
import { logger } from "~/utils/monitoring/logger.server";
import { requireAnonymous } from "~/utils/auth/session.server";
import {
  prepareVerification,
  getVerifySession,
  commitVerifySession,
} from "~/utils/auth/verification.server";
import { signupSchema } from "~/utils/schemas/auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AuthContent } from "~/components/auth/auth-layout";
import { Mail, ArrowRight } from "lucide-react";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/signup";

export const meta: Route.MetaFunction = () => buildMeta("Sign Up", "Create a new account");

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: signupSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { email } = submission.value;

  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) {
    return data(
      submission.reply({
        fieldErrors: {
          email: ["An account with this email already exists"],
        },
      }),
      { status: 400 },
    );
  }

  const { otp } = await prepareVerification({
    type: "onboarding",
    target: email,
  });

  const template = otpEmail(otp, email);
  await sendEmail({ to: email, ...template }).catch((err) => {
    logger.error({ email, err }, "Failed to send signup OTP email");
  });
  logger.info(
    { email, ...(process.env.NODE_ENV === "development" && { otp }) },
    "Signup OTP sent (dev: check logs or Mailpit)",
  );

  const verifySession = await getVerifySession(request);
  verifySession.set("onboardingEmail", email);

  return redirect("/auth/verify?type=onboarding", {
    headers: {
      "Set-Cookie": await commitVerifySession(verifySession),
    },
  });
}

export default function SignupPage({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation("auth");
  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: signupSchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <AuthContent>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("signupTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("signupSubtitle")}</p>
      </div>

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
              const { key, ...emailProps } = getInputProps(fields.email, { type: "email" });
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
          <span className="flex items-center gap-2">
            {t("continue")}
            <ArrowRight className="size-4" />
          </span>
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
        {t("haveAccount")}{" "}
        <Link
          to="/auth/login"
          className="font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          {t("logIn")}
        </Link>
      </p>
    </AuthContent>
  );
}
