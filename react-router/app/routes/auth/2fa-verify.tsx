import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { twoFAVerificationType, unverifiedSessionIdKey } from "~/utils/auth/2fa-constants";
import { prisma } from "~/utils/db/db.server";
import {
  getVerifySession,
  isCodeValid,
  handleTwoFAVerification,
} from "~/utils/auth/verification.server";
import { twoFAVerifySchema as twoFASchema } from "~/utils/schemas/auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AuthContent } from "~/components/auth/auth-layout";
import { Shield } from "lucide-react";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/2fa-verify";

export const meta: Route.MetaFunction = () =>
  buildMeta("Two-Factor Verification", "Enter your verification code");

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
    <AuthContent>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Two-Factor Authentication
        </h1>
        <p className="mt-2 text-muted-foreground">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-5">
        {form.errors && form.errors.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 animate-[shake_0.5s_ease-in-out]">
            <p className="text-sm text-destructive">{form.errors[0]}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={fields.code.id} className="text-sm font-medium">
            Verification Code
          </Label>
          <div className="relative group">
            <Shield className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
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
          <Link
            to="/auth/2fa-recovery"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Use a recovery code
          </Link>
        </div>
      </Form>
    </AuthContent>
  );
}
