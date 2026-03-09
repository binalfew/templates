import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { hashPassword } from "~/utils/auth/auth.server";
import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";
import { createUserSession } from "~/utils/auth/session.server";
import { acceptInviteSchema } from "~/utils/schemas/invitation";
import { getInvitationByToken, acceptInvitation } from "~/services/invitations.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AuthContent } from "~/components/auth/auth-layout";
import { User, Lock, AtSign, AlertTriangle } from "lucide-react";
import { buildMeta } from "~/utils/meta";
import type { Route } from "./+types/accept-invite";

export const meta: Route.MetaFunction = () => buildMeta("Accept Invitation", "Join your team");

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    throw redirect("/auth/login");
  }

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return { valid: false, email: "", tenantName: "", token };
  }

  if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    return { valid: false, email: invitation.email, tenantName: invitation.tenant.name, token };
  }

  return {
    valid: true,
    email: invitation.email,
    tenantName: invitation.tenant.name,
    token,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: acceptInviteSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { token, name, username, password } = submission.value;

  const invitation = await getInvitationByToken(token);
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    return data(
      submission.reply({ formErrors: ["This invitation is no longer valid."] }),
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findFirst({ where: { email: invitation.email } });
  if (existingUser) {
    return data(
      submission.reply({
        formErrors: ["An account with this email already exists. Please log in instead."],
      }),
      { status: 400 },
    );
  }

  const existingUsername = await prisma.user.findFirst({ where: { username } });
  if (existingUsername) {
    return data(
      submission.reply({ fieldErrors: { username: ["This username is already taken"] } }),
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: invitation.email,
      name,
      username,
      tenantId: invitation.tenantId,
      password: { create: { hash: passwordHash } },
    },
  });

  await acceptInvitation(token, user.id);

  logger.info({ userId: user.id, email: invitation.email }, "User created via invitation");

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      tenantId: invitation.tenantId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `User created via invitation from ${invitation.invitedById}`,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  return createUserSession(request, user.id, `/${invitation.tenant.slug}`);
}

export default function AcceptInvitePage({ loaderData, actionData }: Route.ComponentProps) {
  const { valid, email, tenantName, token } = loaderData;

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: acceptInviteSchema });
    },
    shouldRevalidate: "onBlur",
  });

  if (!valid) {
    return (
      <AuthContent>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invitation expired</h1>
          <p className="mt-2 text-muted-foreground">
            This invitation is no longer valid. Please ask for a new one.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This invitation link has expired or is no longer valid.
          </p>
        </div>

        <Link to="/auth/login">
          <Button
            className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25"
            size="lg"
          >
            Go to login
          </Button>
        </Link>
      </AuthContent>
    );
  }

  return (
    <AuthContent>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Join {tenantName}</h1>
        <p className="mt-2 text-muted-foreground">Create your account to accept the invitation.</p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-5">
        <input type="hidden" name="token" value={token} />

        {form.errors && form.errors.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 animate-[shake_0.5s_ease-in-out]">
            <p className="text-sm text-destructive">{form.errors[0]}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Email</Label>
          <Input value={email} disabled className="h-11 bg-muted" />
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
                  autoFocus
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
                  autoComplete="username"
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
        </div>

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
