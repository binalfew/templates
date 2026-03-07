import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useParams } from "react-router";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";
import { sendEmail } from "~/utils/email/email.server";
import { otpEmail } from "~/utils/email/email-templates.server";
import {
  isCodeValid,
  getVerifySession,
  destroyVerifySession,
  prepareVerification,
} from "~/utils/auth/verification.server";
import { verifyProfileEmailSchema as verifySchema } from "~/utils/schemas/profile";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/verify-email";

export const handle = { breadcrumb: "Verify Email" };

export async function loader({ request, params }: Route.LoaderArgs) {
  const verifySession = await getVerifySession(request);
  const newEmail = verifySession.get("changeEmail");
  if (!newEmail || typeof newEmail !== "string") {
    throw redirect(`/${params.tenant}/profile/change-email`);
  }
  return { maskedEmail: maskEmail(newEmail) };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const verifySession = await getVerifySession(request);
  const newEmail = verifySession.get("changeEmail");
  const userId = verifySession.get("changeEmailUserId");

  if (!newEmail || typeof newEmail !== "string" || !userId || typeof userId !== "string") {
    throw redirect(`/${params.tenant}/profile/change-email`);
  }

  const intent = formData.get("intent");

  // Handle resend
  if (intent === "resend") {
    const { otp } = await prepareVerification({
      type: "change-email",
      target: newEmail,
      userId,
    });

    const emailTemplate = otpEmail(otp, newEmail);
    await sendEmail({ to: newEmail, subject: emailTemplate.subject, html: emailTemplate.html, text: emailTemplate.text });
    logger.debug({ newEmail }, "Email change verification code resent");

    return data({ status: "resent" as const });
  }

  // Handle verify
  const submission = parseWithZod(formData, { schema: verifySchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { code } = submission.value;

  const isValid = await isCodeValid({
    code,
    type: "change-email",
    target: newEmail,
  });

  if (!isValid) {
    return data(
      submission.reply({
        fieldErrors: {
          code: ["Invalid or expired code. Please try again."],
        },
      }),
      { status: 400 },
    );
  }

  // Check email is still available
  const existing = await prisma.user.findFirst({
    where: { email: newEmail, id: { not: userId } },
    select: { id: true },
  });
  if (existing) {
    return data(
      submission.reply({
        fieldErrors: {
          code: ["This email is no longer available. Please try a different email."],
        },
      }),
      { status: 400 },
    );
  }

  // Update the user's email
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
    });
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      return data(
        submission.reply({
          fieldErrors: {
            code: ["This email is already in use. Please try a different email."],
          },
        }),
        { status: 400 },
      );
    }
    throw error;
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      userId,
      description: "Email address changed",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: { newEmail },
    },
  });

  logger.info({ userId, newEmail }, "Email address changed successfully");

  // Clear verify session and redirect
  return redirect(`/${params.tenant}/profile`, {
    headers: {
      "Set-Cookie": await destroyVerifySession(verifySession),
    },
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

export default function VerifyEmailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { maskedEmail } = loaderData;
  const params = useParams();
  const wasResent = actionData && "status" in actionData && actionData.status === "resent";

  const [form, fields] = useForm({
    lastResult: wasResent ? undefined : (actionData as Record<string, unknown> | undefined),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: verifySchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/${params.tenant}/profile/change-email`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Verify New Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-digit code sent to {maskedEmail}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Verification Code
          </CardTitle>
          <CardDescription>
            Check your inbox for the verification code. It expires in 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="space-y-4">
            {form.errors && form.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {form.errors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}

            {wasResent && (
              <div className="rounded-md bg-green-50 p-3 dark:bg-green-950">
                <p className="text-sm text-green-700 dark:text-green-400">
                  A new code has been sent to your email.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              {(() => {
                const { key, ...codeProps } = getInputProps(fields.code, {
                  type: "text",
                });
                return (
                  <Input
                    key={key}
                    {...codeProps}
                    placeholder="XXXXXX"
                    autoComplete="one-time-code"
                    autoFocus
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                );
              })()}
              {fields.code.errors && (
                <p className="text-sm text-destructive">{fields.code.errors[0]}</p>
              )}
            </div>

            <input type="hidden" name="intent" value="verify" />

            <Button type="submit" className="w-full">
              Verify & Update Email
            </Button>
          </Form>

          <Form method="post" className="mt-4">
            <input type="hidden" name="intent" value="resend" />
            <input type="hidden" name="code" value="000000" />
            <div className="text-center text-sm">
              Didn&apos;t receive the code?{" "}
              <button type="submit" className="underline underline-offset-4 hover:text-primary">
                Resend code
              </button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
