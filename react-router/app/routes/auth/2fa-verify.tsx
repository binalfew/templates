import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod/v4";
import { twoFAVerificationType, unverifiedSessionIdKey } from "~/lib/2fa-constants";
import { prisma } from "~/lib/db.server";
import { getVerifySession, isCodeValid, handleTwoFAVerification } from "~/lib/verification.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/2fa-verify";

const twoFASchema = z.object({
  code: z.string().min(6, "Code must be 6 digits").max(6, "Code must be 6 digits"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const verifySession = await getVerifySession(request);
  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey);
  if (!unverifiedSessionId) {
    throw redirect("/auth/login");
  }

  const dbSession = await prisma.session.findUnique({
    where: { id: unverifiedSessionId },
    select: { id: true },
  });
  if (!dbSession) {
    throw redirect("/auth/login");
  }

  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const verifySession = await getVerifySession(request);
  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey);
  if (!unverifiedSessionId) {
    throw redirect("/auth/login");
  }

  const dbSession = await prisma.session.findUnique({
    where: { id: unverifiedSessionId },
    select: { userId: true },
  });
  if (!dbSession) {
    throw redirect("/auth/login");
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: twoFASchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { code } = submission.value;

  const valid = await isCodeValid({
    code,
    type: twoFAVerificationType,
    target: dbSession.userId,
    deleteOnSuccess: false,
  });

  if (!valid) {
    return data(
      submission.reply({
        fieldErrors: { code: ["Invalid code. Please check and try again."] },
      }),
      { status: 400 },
    );
  }

  const redirectToValue = verifySession.get("redirectTo") as string | undefined;
  return handleTwoFAVerification({
    request,
    redirectTo: redirectToValue || "/",
  });
}

export default function TwoFAVerifyPage({ actionData }: Route.ComponentProps) {
  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: twoFASchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
              <CardDescription>
                Enter the 6-digit code from your authenticator app to continue.
              </CardDescription>
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

                  <div className="text-center text-sm">
                    <Link to="/auth/2fa-recovery" className="underline underline-offset-4">
                      Use a recovery code
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
