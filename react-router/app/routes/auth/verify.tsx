import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, redirect } from "react-router";
import { sendEmail } from "~/utils/email/email.server";
import { otpEmail } from "~/utils/email/email-templates.server";
import { logger } from "~/utils/monitoring/logger.server";
import {
  getVerifySession,
  commitVerifySession,
  isCodeValid,
  prepareVerification,
} from "~/utils/auth/verification.server";
import { verifyEmailSchema as verifySchema } from "~/utils/schemas/auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AuthContent } from "~/components/auth/auth-layout";
import { Mail, CheckCircle2 } from "lucide-react";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/verify";

export const meta: Route.MetaFunction = () => buildMeta("Verify Email", "Verify your email address");

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "onboarding") {
    throw redirect("/auth/login");
  }

  const verifySession = await getVerifySession(request);
  const email = verifySession.get("onboardingEmail");
  if (!email || typeof email !== "string") {
    throw redirect("/auth/signup");
  }

  return { maskedEmail: maskEmail(email) };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  const verifySession = await getVerifySession(request);
  const email = verifySession.get("onboardingEmail");
  if (!email || typeof email !== "string") {
    throw redirect("/auth/signup");
  }

  if (intent === "resend") {
    const { otp } = await prepareVerification({
      type: "onboarding",
      target: email,
    });
    const template = otpEmail(otp, email);
    await sendEmail({ to: email, ...template }).catch((err) => {
      logger.error({ email, err }, "Failed to resend OTP email");
    });
    logger.info(
      { email, ...(process.env.NODE_ENV === "development" && { otp }) },
      "Signup OTP resent (dev: check logs or Mailpit)",
    );
    return data({ status: "resent" as const });
  }

  const submission = parseWithZod(formData, { schema: verifySchema });
  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { code } = submission.value;

  const valid = await isCodeValid({
    code,
    type: "onboarding",
    target: email,
  });

  if (!valid) {
    return data(
      submission.reply({
        fieldErrors: { code: ["Invalid or expired code"] },
      }),
      { status: 400 },
    );
  }

  verifySession.set("verifiedEmail", email);

  return redirect("/auth/onboarding", {
    headers: {
      "Set-Cookie": await commitVerifySession(verifySession),
    },
  });
}

export default function VerifyPage({ loaderData, actionData }: Route.ComponentProps) {
  const { maskedEmail } = loaderData;
  const [form, fields] = useForm({
    lastResult: actionData && "status" in actionData ? undefined : actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: verifySchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <AuthContent>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Verify your email</h1>
        <p className="mt-2 text-muted-foreground">We sent a 6-digit code to {maskedEmail}</p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-5">
        <input type="hidden" name="intent" value="verify" />

        {form.errors && form.errors.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 animate-[shake_0.5s_ease-in-out]">
            <p className="text-sm text-destructive">{form.errors[0]}</p>
          </div>
        )}

        {actionData && "status" in actionData && actionData.status === "resent" && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
            <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              A new code has been sent to your email.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={fields.code.id} className="text-sm font-medium">
            Verification Code
          </Label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            {(() => {
              const { key, ...codeProps } = getInputProps(fields.code, { type: "text" });
              return (
                <Input
                  key={key}
                  {...codeProps}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="h-11 pl-10 text-center text-lg tracking-widest transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                />
              );
            })()}
          </div>
          {fields.code.errors && (
            <p className="text-sm text-destructive">{fields.code.errors[0]}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
          size="lg"
        >
          Verify
        </Button>

        <div className="text-center">
          <Form method="post">
            <input type="hidden" name="intent" value="resend" />
            <Button type="submit" variant="link" className="text-sm text-muted-foreground">
              Didn&apos;t receive a code? Resend
            </Button>
          </Form>
        </div>
      </Form>
    </AuthContent>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}
