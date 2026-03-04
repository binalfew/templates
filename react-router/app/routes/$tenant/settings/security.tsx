import { Form, useLoaderData, redirect } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { Info, Shield } from "lucide-react";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/lib/auth/roles";
import { listRoles } from "~/services/roles.server";
import { getTwoFAPolicy } from "~/services/2fa-enforcement.server";
import { setSetting } from "~/lib/config/settings.server";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Separator } from "~/components/ui/separator";
import type { Route } from "./+types/security";

export const handle = { breadcrumb: "Security" };

export async function loader({ request }: Route.LoaderArgs) {
  const { user, roles } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const twoFactorEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR, {
    tenantId,
    roles,
    userId: user.id,
  });

  const policy = await getTwoFAPolicy(tenantId);
  const tenantRoles = await listRoles(tenantId);

  return { twoFactorEnabled, policy, tenantRoles };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const mode = formData.get("mode") as string;

  let value = "off";
  if (mode === "all") {
    value = "all";
  } else if (mode === "roles") {
    const selectedRoles = formData.getAll("roleIds") as string[];
    if (selectedRoles.length > 0) {
      value = `roles:${selectedRoles.join(",")}`;
    }
  }

  await setSetting(
    {
      key: "security.require2fa",
      value,
      type: "string",
      category: "auth",
      scope: "tenant",
      scopeId: tenantId,
    },
    {
      userId: user.id,
      tenantId,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  );

  return redirect(`/${request.url.split("/")[3]}/settings/security`);
}

export default function SecuritySettingsPage() {
  const { twoFactorEnabled, policy, tenantRoles } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Security Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure security policies for your organization.
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication Enforcement
          </CardTitle>
          <CardDescription>
            Require users to set up two-factor authentication before they can access the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!twoFactorEnabled ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Feature Flag Required</AlertTitle>
              <AlertDescription>
                The Two-Factor Authentication feature flag (FF_TWO_FACTOR) must be enabled before you
                can configure enforcement policies. Go to Feature Flags settings to enable it.
              </AlertDescription>
            </Alert>
          ) : (
            <Form method="post" className="space-y-6">
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium">Enforcement Mode</legend>

                <RadioGroup name="mode" defaultValue={policy.mode}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <RadioGroupItem value="off" className="mt-0.5" />
                    <div>
                      <p className="font-medium">Off</p>
                      <p className="text-sm text-muted-foreground">
                        Two-factor authentication is available but optional. Users can choose to enable
                        it from their profile.
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <RadioGroupItem value="all" className="mt-0.5" />
                    <div>
                      <p className="font-medium">All Users</p>
                      <p className="text-sm text-muted-foreground">
                        All users must set up two-factor authentication. Users who haven&apos;t will be
                        required to complete setup on their next login.
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <RadioGroupItem value="roles" className="mt-0.5" />
                    <div>
                      <p className="font-medium">Specific Roles</p>
                      <p className="text-sm text-muted-foreground">
                        Only users with selected roles are required to set up two-factor
                        authentication.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </fieldset>

              {tenantRoles.length > 0 && (
                <fieldset className="space-y-3">
                  <Label asChild>
                    <legend>Select Roles (for &quot;Specific Roles&quot; mode)</legend>
                  </Label>
                  <div className="space-y-2 rounded-lg border p-4">
                    {tenantRoles.map((role) => (
                      <label key={role.id} className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          name="roleIds"
                          value={role.id}
                          defaultChecked={policy.roleIds.includes(role.id)}
                        />
                        <span className="text-sm">
                          {role.name}
                          <span className="ml-2 text-muted-foreground">
                            ({role._count.userRoles}{" "}
                            {role._count.userRoles === 1 ? "user" : "users"})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="pt-2">
                <Button type="submit">Save Policy</Button>
              </div>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
