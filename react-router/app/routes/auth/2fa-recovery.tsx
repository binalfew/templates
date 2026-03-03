import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { unverifiedSessionIdKey } from "~/lib/auth/2fa-constants";
import { prisma } from "~/lib/db/db.server";
import { getVerifySession, handleTwoFAVerification } from "~/lib/auth/verification.server";
import { validateRecoveryCode } from "~/services/recovery-codes.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/2fa-recovery";

const recoverySchema = z.object({
  code: z.string().min(1, "Recovery code is required"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const verifySession = await getVerifySession(request);
  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey);
  if (!unverifiedSessionId) {
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
  const submission = parseWithZod(formData, { schema: recoverySchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const valid = await validateRecoveryCode(dbSession.userId, submission.value.code);
  if (!valid) {
    return data(
      submission.reply({
        fieldErrors: { code: ["Invalid or already used recovery code."] },
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

export default function TwoFARecoveryPage({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation("auth");
  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: recoverySchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("recoveryCodeTitle")}</CardTitle>
              <CardDescription>
                {t("recoveryCodeSubtitle")}
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
                    <Label htmlFor={fields.code.id}>{t("recoveryCode")}</Label>
                    {(() => {
                      const { key, ...codeProps } = getInputProps(fields.code, { type: "text" });
                      return (
                        <Input
                          key={key}
                          {...codeProps}
                          placeholder="abcd1234"
                          autoComplete="off"
                          autoFocus
                          className="font-mono"
                        />
                      );
                    })()}
                    {fields.code.errors && (
                      <p className="text-sm text-destructive">{fields.code.errors[0]}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full">
                    {t("verifyRecoveryCode")}
                  </Button>

                  <div className="text-center text-sm">
                    <Link to="/auth/2fa-verify" className="underline underline-offset-4">
                      Use authenticator code instead
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
