import { Form, Link, redirect } from "react-router";
import { AlertTriangle, Shield, ShieldOff, XCircle } from "lucide-react";
import { twoFAVerificationType } from "~/utils/auth/2fa-constants";
import { prisma } from "~/utils/db/db.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { requireUserId } from "~/utils/auth/session.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/disable";

export const handle = { breadcrumb: "Disable 2FA" };

export async function loader({ request, params }: Route.LoaderArgs) {
  const twoFAFlagEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR);
  if (!twoFAFlagEnabled) {
    throw redirect(`/${params.tenant}/profile`);
  }

  await requireUserId(request);
  return {};
}

export async function action({ request, params }: Route.ActionArgs) {
  const twoFAFlagEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR);
  if (!twoFAFlagEnabled) {
    throw redirect(`/${params.tenant}/profile`);
  }

  const userId = await requireUserId(request);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, tenantId: true },
  });

  await prisma.verification.delete({
    where: {
      target_type: {
        target: userId,
        type: twoFAVerificationType,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      tenantId: user?.tenantId,
      action: "TWO_FACTOR_DISABLE",
      entityType: "User",
      entityId: userId,
      description: `Two-factor authentication disabled for ${user?.email}`,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  return redirect(`/${params.tenant}/profile/two-factor`);
}

export default function TwoFactorDisablePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldOff className="h-5 w-5" />
            Disable Two-Factor Authentication
          </CardTitle>
          <CardDescription>Remove the additional security layer from your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning Banner */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">
                  Warning: This will reduce your account security
                </p>
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Disabling two-factor authentication will make your account more vulnerable to
                  unauthorized access.
                </p>
              </div>
            </div>
          </div>

          {/* Consequences */}
          <div className="space-y-3">
            <p className="text-sm font-medium">If you disable 2FA:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-4 w-4 text-red-500" />
                <p className="text-sm text-muted-foreground">
                  You won&apos;t need a code to log in anymore
                </p>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-4 w-4 text-red-500" />
                <p className="text-sm text-muted-foreground">
                  Your account will only be protected by your password
                </p>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-4 w-4 text-red-500" />
                <p className="text-sm text-muted-foreground">
                  If someone gets your password, they can access your account
                </p>
              </div>
            </div>
          </div>

          {/* Re-enable note */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You can re-enable two-factor authentication at any time from your account settings.
              </p>
            </div>
          </div>

          {/* Actions */}
          <Form method="POST">
            <div className="flex gap-3">
              <Button type="submit" variant="destructive" className="flex-1">
                <ShieldOff className="mr-2 h-4 w-4" />
                Disable 2FA
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="..">Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
