import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useLoaderData } from "react-router";
import { Shield, KeyRound, Monitor, ShieldCheck, ShieldAlert } from "lucide-react";
import { twoFAVerificationType } from "~/lib/auth/2fa-constants";
import { prisma } from "~/lib/db/db.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { requireUserId } from "~/lib/auth/session.server";
import { profileSchema } from "~/lib/schemas/profile";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Field } from "~/components/ui/field";
import { PhotoUpload } from "~/components/photo-upload";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Profile" };

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, username: true, photoUrl: true },
  });

  const twoFAFlagEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR);

  const [sessionCount, twoFAVerification] = await Promise.all([
    prisma.session.count({
      where: { userId, expirationDate: { gt: new Date() } },
    }),
    twoFAFlagEnabled
      ? prisma.verification.findUnique({
          select: { id: true },
          where: { target_type: { target: userId, type: twoFAVerificationType } },
        })
      : null,
  ]);

  return {
    user,
    sessionCount,
    twoFAFlagEnabled,
    isTwoFAEnabled: Boolean(twoFAVerification),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: profileSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { name, username, photoUrl } = submission.value;

  // Check username uniqueness
  const existing = await prisma.user.findFirst({
    where: { username, id: { not: userId } },
    select: { id: true },
  });
  if (existing) {
    return data(submission.reply({ fieldErrors: { username: ["Username is already taken"] } }), {
      status: 400,
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name, username, photoUrl: photoUrl || null },
  });

  return redirect(`/${params.tenant}/profile`);
}

function getUserInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export default function ProfilePage({ actionData }: Route.ComponentProps) {
  const { user, sessionCount, twoFAFlagEnabled, isTwoFAEnabled } = useLoaderData<typeof loader>();

  const [form, fields] = useForm({
    lastResult: actionData,
    defaultValue: {
      name: user.name ?? "",
      username: user.username,
      photoUrl: user.photoUrl ?? "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: profileSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account settings and security.
        </p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name and username.</CardDescription>
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

            <PhotoUpload
              initialPhotoUrl={user.photoUrl}
              fallbackInitials={getUserInitials(user.name, user.email)}
            />

            <Separator />

            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input value={user.email} disabled className="bg-muted" />
            </div>

            <Field fieldId={fields.name.id} label="Name" required errors={fields.name.errors}>
              <Input
                {...getInputProps(fields.name, { type: "text" })}
                key={fields.name.key}
                placeholder="Your full name"
              />
            </Field>

            <Field
              fieldId={fields.username.id}
              label="Username"
              required
              errors={fields.username.errors}
            >
              <Input
                {...getInputProps(fields.username, { type: "text" })}
                key={fields.username.key}
                placeholder="your-username"
              />
            </Field>

            <div className="pt-2">
              <Button type="submit">Save Changes</Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Change Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-sm text-muted-foreground">Change your account password</p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="change-password">Change Password</Link>
            </Button>
          </div>

          {twoFAFlagEnabled && (
            <>
              <Separator />

              {/* Two-Factor Authentication */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isTwoFAEnabled ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                      <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">
                      {isTwoFAEnabled
                        ? "Your account is protected with 2FA"
                        : "Add an extra layer of security to your account"}
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="two-factor">
                    {isTwoFAEnabled ? "Manage" : "Enable"}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>Manage devices that are logged in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {sessionCount} active {sessionCount === 1 ? "session" : "sessions"}
              </p>
              <p className="text-sm text-muted-foreground">
                View and manage all your active sessions
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="sessions">View Sessions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
