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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/signup";

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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("signupTitle")}</CardTitle>
              <CardDescription>{t("signupSubtitle")}</CardDescription>
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
                      const { key, ...emailProps } = getInputProps(fields.email, { type: "email" });
                      return (
                        <Input
                          key={key}
                          {...emailProps}
                          placeholder="m@example.com"
                          autoComplete="email"
                          autoFocus
                        />
                      );
                    })()}
                    {fields.email.errors && (
                      <p className="text-sm text-destructive">{fields.email.errors[0]}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full">
                    {t("continue")}
                  </Button>

                  <div className="text-center text-sm">
                    {t("haveAccount")}{" "}
                    <Link to="/auth/login" className="underline underline-offset-4">
                      {t("logIn")}
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
