import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, redirect } from "react-router";
import { z } from "zod/v4";
import { sendEmail } from "~/lib/email.server";
import { otpEmail } from "~/lib/email-templates.server";
import { logger } from "~/lib/logger.server";
import {
  getVerifySession,
  commitVerifySession,
  isCodeValid,
  prepareVerification,
} from "~/lib/verification.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/verify";

const verifySchema = z.object({
  code: z.string().min(6, "Code must be 6 characters").max(6, "Code must be 6 characters"),
  intent: z.enum(["verify", "resend"]),
});

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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Verify your email</CardTitle>
              <CardDescription>We sent a 6-digit code to {maskedEmail}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" {...getFormProps(form)}>
                <input type="hidden" name="intent" value="verify" />
                <div className="flex flex-col gap-6">
                  {form.errors && form.errors.length > 0 && (
                    <div className="rounded-md bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">{form.errors[0]}</p>
                    </div>
                  )}

                  {actionData && "status" in actionData && actionData.status === "resent" && (
                    <div className="rounded-md bg-green-50 p-3 dark:bg-green-950">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        A new code has been sent to your email.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor={fields.code.id}>Verification Code</Label>
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
                          className="text-center text-lg tracking-widest"
                        />
                      );
                    })()}
                    {fields.code.errors && (
                      <p className="text-sm text-destructive">{fields.code.errors[0]}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full">
                    Verify
                  </Button>

                  <div className="text-center">
                    <Form method="post">
                      <input type="hidden" name="intent" value="resend" />
                      <Button type="submit" variant="link" className="text-sm">
                        Didn't receive a code? Resend
                      </Button>
                    </Form>
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

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}
