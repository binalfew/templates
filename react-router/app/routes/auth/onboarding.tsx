import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, redirect } from "react-router";
import { hashPassword } from "~/utils/auth/auth.server";
import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";
import { requireAnonymous, getDefaultRedirect, createUserSession } from "~/utils/auth/session.server";
import { requireOnboardingEmail, getVerifySession } from "~/utils/auth/verification.server";
import { onboardingSchema } from "~/utils/schemas/auth";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AuthContent } from "~/components/auth/auth-layout";
import { User, Lock, AtSign } from "lucide-react";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/onboarding";

export const meta: Route.MetaFunction = () => buildMeta("Onboarding", "Complete your account setup");

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  const email = await requireOnboardingEmail(request);
  return { email };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request);

  const verifySession = await getVerifySession(request);
  const email = verifySession.get("verifiedEmail") as string | undefined;
  if (!email) throw redirect("/auth/signup");

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: onboardingSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { username, name, password } = submission.value;

  const existingUsername = await prisma.user.findFirst({
    where: { username },
  });
  if (existingUsername) {
    return data(
      submission.reply({
        fieldErrors: {
          username: ["This username is already taken"],
        },
      }),
      { status: 400 },
    );
  }

  const existingEmail = await prisma.user.findFirst({
    where: { email },
  });
  if (existingEmail) {
    return data(
      submission.reply({
        formErrors: ["An account with this email already exists. Please log in instead."],
      }),
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        username,
        name,
        password: { create: { hash: passwordHash } },
      },
    });

    const viewerRole = await tx.role.findFirst({
      where: { name: "VIEWER" },
    });
    if (viewerRole) {
      await tx.userRole.create({
        data: { userId: newUser.id, roleId: viewerRole.id },
      });
    }

    return newUser;
  });

  logger.info({ userId: user.id, email }, "New user registered via signup");

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: "User registered via signup flow",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  const redirectUrl = await getDefaultRedirect(user.id);
  return createUserSession(request, user.id, redirectUrl);
}

export default function OnboardingPage({ loaderData, actionData }: Route.ComponentProps) {
  const { email } = loaderData;
  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingSchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <AuthContent>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Complete your profile
        </h1>
        <p className="mt-2 text-muted-foreground">Setting up account for {email}</p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-5">
        {form.errors && form.errors.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 animate-[shake_0.5s_ease-in-out]">
            <p className="text-sm text-destructive">{form.errors[0]}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={fields.username.id} className="text-sm font-medium">
            Username
          </Label>
          <div className="relative group">
            <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            {(() => {
              const { key, ...props } = getInputProps(fields.username, { type: "text" });
              return (
                <Input
                  key={key}
                  {...props}
                  placeholder="johndoe"
                  autoComplete="username"
                  autoFocus
                  className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                />
              );
            })()}
          </div>
          {fields.username.errors && (
            <p className="text-sm text-destructive">{fields.username.errors[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.name.id} className="text-sm font-medium">
            Full name
          </Label>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            {(() => {
              const { key, ...props } = getInputProps(fields.name, { type: "text" });
              return (
                <Input
                  key={key}
                  {...props}
                  placeholder="John Doe"
                  autoComplete="name"
                  className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                />
              );
            })()}
          </div>
          {fields.name.errors && (
            <p className="text-sm text-destructive">{fields.name.errors[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.password.id} className="text-sm font-medium">
            Password
          </Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            {(() => {
              const { key, ...props } = getInputProps(fields.password, { type: "password" });
              return (
                <Input
                  key={key}
                  {...props}
                  autoComplete="new-password"
                  className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                />
              );
            })()}
          </div>
          {fields.password.errors && (
            <p className="text-sm text-destructive">{fields.password.errors[0]}</p>
          )}
          <p className="text-xs text-muted-foreground">
            8+ chars, uppercase, lowercase, digit, special character
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={fields.confirmPassword.id} className="text-sm font-medium">
            Confirm password
          </Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            {(() => {
              const { key, ...props } = getInputProps(fields.confirmPassword, {
                type: "password",
              });
              return (
                <Input
                  key={key}
                  {...props}
                  autoComplete="new-password"
                  className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
                />
              );
            })()}
          </div>
          {fields.confirmPassword.errors && (
            <p className="text-sm text-destructive">{fields.confirmPassword.errors[0]}</p>
          )}
        </div>

        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id={fields.agreeToTerms.id}
            name={fields.agreeToTerms.name}
            value="on"
            className="mt-1"
          />
          <Label htmlFor={fields.agreeToTerms.id} className="text-sm font-normal leading-snug">
            I agree to the terms of service and privacy policy
          </Label>
        </div>
        {fields.agreeToTerms.errors && (
          <p className="text-sm text-destructive">{fields.agreeToTerms.errors[0]}</p>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
          size="lg"
        >
          Create account
        </Button>
      </Form>
    </AuthContent>
  );
}
