import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { hashPassword } from "~/lib/auth/auth.server";
import { prisma } from "~/lib/db/db.server";
import { logger } from "~/lib/monitoring/logger.server";
import { createUserSession } from "~/lib/auth/session.server";
import { acceptInviteSchema } from "~/lib/schemas/invitation";
import { getInvitationByToken, acceptInvitation } from "~/services/invitations.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/accept-invite";

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

  // Check if email is already registered
  const existingUser = await prisma.user.findFirst({ where: { email: invitation.email } });
  if (existingUser) {
    return data(
      submission.reply({
        formErrors: ["An account with this email already exists. Please log in instead."],
      }),
      { status: 400 },
    );
  }

  // Check username uniqueness
  const existingUsername = await prisma.user.findFirst({ where: { username } });
  if (existingUsername) {
    return data(
      submission.reply({ fieldErrors: { username: ["This username is already taken"] } }),
      { status: 400 },
    );
  }

  // Create user
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

  // Accept invitation (assigns roles)
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

  // Auto-login
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
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Invitation expired</CardTitle>
              <CardDescription>
                This invitation is no longer valid. Please ask for a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/auth/login">
                <Button className="w-full">Go to login</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Join {tenantName}</CardTitle>
              <CardDescription>Create your account to accept the invitation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" {...getFormProps(form)}>
                <input type="hidden" name="token" value={token} />
                <div className="flex flex-col gap-4">
                  {form.errors && form.errors.length > 0 && (
                    <div className="rounded-md bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">{form.errors[0]}</p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input value={email} disabled className="bg-muted" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={fields.name.id}>Full name</Label>
                    {(() => {
                      const { key, ...props } = getInputProps(fields.name, { type: "text" });
                      return <Input key={key} {...props} autoFocus />;
                    })()}
                    {fields.name.errors && (
                      <p className="text-sm text-destructive">{fields.name.errors[0]}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={fields.username.id}>Username</Label>
                    {(() => {
                      const { key, ...props } = getInputProps(fields.username, { type: "text" });
                      return <Input key={key} {...props} autoComplete="username" />;
                    })()}
                    {fields.username.errors && (
                      <p className="text-sm text-destructive">{fields.username.errors[0]}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={fields.password.id}>Password</Label>
                    {(() => {
                      const { key, ...props } = getInputProps(fields.password, {
                        type: "password",
                      });
                      return <Input key={key} {...props} autoComplete="new-password" />;
                    })()}
                    {fields.password.errors && (
                      <p className="text-sm text-destructive">{fields.password.errors[0]}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full">
                    Create account
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
