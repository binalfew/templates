import { data, Form, redirect, Link, useLoaderData, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Invite User" };

import { requirePermission } from "~/lib/auth/require-auth.server";
import { inviteUserSchema } from "~/lib/schemas/invitation";
import { createInvitation } from "~/services/invitations.server";
import { prisma } from "~/lib/db/db.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/invite";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const roles = await prisma.role.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true, scope: true },
    orderBy: { name: "asc" },
  });

  return { roles };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: inviteUserSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { email, roleIds } = submission.value;

  // Check if user already exists in this tenant
  const existingUser = await prisma.user.findFirst({ where: { email, tenantId } });
  if (existingUser) {
    return data(
      submission.reply({
        fieldErrors: { email: ["A user with this email already exists in this organization"] },
      }),
      { status: 400 },
    );
  }

  await createInvitation({
    email,
    tenantId,
    roleIds,
    invitedById: user.id,
  });

  const redirectTo = new URL(request.url).searchParams.get("redirectTo");
  if (redirectTo) {
    throw redirect(redirectTo);
  }
  const base = `/${(await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }))?.slug}`;
  throw redirect(`${base}/security/users`);
}

export default function InviteUserPage({ actionData }: Route.ComponentProps) {
  const { roles } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${base}/security/users`;

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: inviteUserSchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Invite User</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an invitation to join your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)}>
            <div className="space-y-4">
              {form.errors && form.errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{form.errors[0]}</p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor={fields.email.id}>Email address</Label>
                {(() => {
                  const { key, ...props } = getInputProps(fields.email, { type: "email" });
                  return (
                    <Input key={key} {...props} placeholder="user@example.com" autoFocus />
                  );
                })()}
                {fields.email.errors && (
                  <p className="text-sm text-destructive">{fields.email.errors[0]}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Roles</Label>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox name="roleIds" value={role.id} />
                      <span className="text-sm">{role.name}</span>
                      <span className="text-xs text-muted-foreground">({role.scope})</span>
                    </label>
                  ))}
                </div>
                {fields.roleIds.errors && (
                  <p className="text-sm text-destructive">{fields.roleIds.errors[0]}</p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit">Send Invitation</Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={cancelUrl}>Cancel</Link>
                </Button>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
