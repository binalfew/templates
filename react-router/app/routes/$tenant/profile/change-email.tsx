import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useLoaderData, useParams } from "react-router";
import { z } from "zod/v4";
import { Mail, ArrowLeft } from "lucide-react";
import { prisma } from "~/lib/db.server";
import { requireUserId } from "~/lib/session.server";
import { logger } from "~/lib/logger.server";
import {
  prepareVerification,
  getVerifySession,
  commitVerifySession,
} from "~/lib/verification.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import type { Route } from "./+types/change-email";

export const handle = { breadcrumb: "Change Email" };

const changeEmailSchema = z.object({
  newEmail: z.email("Please enter a valid email address"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  return { currentEmail: user.email };
}

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: changeEmailSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { newEmail } = submission.value;

  // Check current email
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });

  if (user.email === newEmail) {
    return data(
      submission.reply({
        fieldErrors: {
          newEmail: ["This is already your current email address"],
        },
      }),
      { status: 400 },
    );
  }

  // Check uniqueness
  const existing = await prisma.user.findFirst({
    where: { email: newEmail, id: { not: userId } },
    select: { id: true },
  });
  if (existing) {
    return data(
      submission.reply({
        fieldErrors: {
          newEmail: ["This email is already in use by another account"],
        },
      }),
      { status: 400 },
    );
  }

  // Generate OTP and send verification email
  const { otp } = await prepareVerification({
    type: "change-email",
    target: newEmail,
    userId,
  });

  // TODO: integrate email provider to send OTP
  logger.info({ userId, newEmail, otp }, "Email change verification code (dev: check logs)");

  // Store new email in verify session for the verify page
  const verifySession = await getVerifySession(request);
  verifySession.set("changeEmail", newEmail);
  verifySession.set("changeEmailUserId", userId);

  return redirect(`/${params.tenant}/profile/verify-email`, {
    headers: {
      "Set-Cookie": await commitVerifySession(verifySession),
    },
  });
}

export default function ChangeEmailPage({ actionData }: Route.ComponentProps) {
  const { currentEmail } = useLoaderData<typeof loader>();
  const params = useParams();

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: changeEmailSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/${params.tenant}/profile`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Change Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your email address. You&apos;ll need to verify the new one.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription>
            A verification code will be sent to your new email address.
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

            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Current Email</label>
              <Input value={currentEmail} disabled className="bg-muted" />
            </div>

            <Field
              fieldId={fields.newEmail.id}
              label="New Email Address"
              required
              errors={fields.newEmail.errors}
            >
              <Input
                {...getInputProps(fields.newEmail, { type: "email" })}
                key={fields.newEmail.key}
                placeholder="your-new-email@example.com"
                autoComplete="email"
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <Button type="submit">Send Verification Code</Button>
              <Button variant="outline" asChild>
                <Link to={`/${params.tenant}/profile`}>Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
