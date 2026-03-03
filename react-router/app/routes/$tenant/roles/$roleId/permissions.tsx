import { useState } from "react";
import { data, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Permissions" };

import { requirePermission } from "~/lib/require-auth.server";
import { getRole, assignPermissions, listPermissions } from "~/services/roles.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/permissions";

const RESOURCE_GROUPS: Record<string, string[]> = {
  Core: ["user", "role", "settings", "feature-flag"],
};

type Permission = { id: string; resource: string; action: string; description: string | null };

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const role = await getRole(params.roleId, tenantId);
  const allPermissions = await listPermissions();

  const currentAssignments: Record<string, string> = {};
  for (const rp of role.rolePermissions) {
    currentAssignments[rp.permissionId] = rp.access;
  }

  const byResource: Record<string, Permission[]> = {};
  for (const perm of allPermissions) {
    if (!byResource[perm.resource]) {
      byResource[perm.resource] = [];
    }
    byResource[perm.resource].push(perm);
  }

  return { role, byResource, currentAssignments };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const permissionIds = formData.getAll("permissionIds") as string[];
  const accessValues = formData.getAll("accessValues") as string[];

  const assignments = permissionIds.map((permissionId, i) => ({
    permissionId,
    access: accessValues[i] || "any",
  }));

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await assignPermissions(params.roleId, assignments, ctx);
    return data({ success: true });
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function RolePermissionsPage() {
  const { role, byResource, currentAssignments } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/roles`;

  const [assignments, setAssignments] = useState<Map<string, string>>(
    () => new Map(Object.entries(currentAssignments)),
  );

  function toggle(id: string) {
    setAssignments((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, "any");
      }
      return next;
    });
  }

  function setAccess(id: string, access: string) {
    setAssignments((prev) => {
      const next = new Map(prev);
      next.set(id, access);
      return next;
    });
  }

  function toggleGroup(resources: string[]) {
    const groupPermIds = resources.flatMap((r) => (byResource[r] ?? []).map((p) => p.id));
    const allChecked = groupPermIds.every((id) => assignments.has(id));
    setAssignments((prev) => {
      const next = new Map(prev);
      for (const id of groupPermIds) {
        if (allChecked) {
          next.delete(id);
        } else if (!next.has(id)) {
          next.set(id, "any");
        }
      }
      return next;
    });
  }

  function isGroupAllChecked(resources: string[]) {
    const groupPermIds = resources.flatMap((r) => (byResource[r] ?? []).map((p) => p.id));
    return groupPermIds.length > 0 && groupPermIds.every((id) => assignments.has(id));
  }

  function isGroupPartiallyChecked(resources: string[]) {
    const groupPermIds = resources.flatMap((r) => (byResource[r] ?? []).map((p) => p.id));
    const checkedCount = groupPermIds.filter((id) => assignments.has(id)).length;
    return checkedCount > 0 && checkedCount < groupPermIds.length;
  }

  const groupedResources = new Set(Object.values(RESOURCE_GROUPS).flat());
  const ungrouped = Object.keys(byResource)
    .filter((r) => !groupedResources.has(r))
    .sort();

  const groups = { ...RESOURCE_GROUPS };
  if (ungrouped.length > 0) {
    groups["Other"] = ungrouped;
  }

  const totalPerms = Object.values(byResource).reduce((sum, perms) => sum + perms.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Manage Permissions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure permissions for the <strong>{role.name}</strong> role.{" "}
          <span className="text-xs">
            ({assignments.size} of {totalPerms} selected)
          </span>
        </p>
      </div>

      {actionData && "success" in actionData && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Permissions updated successfully.
        </div>
      )}

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-4">
        {Array.from(assignments.entries()).map(([id, access]) => (
          <span key={id}>
            <input type="hidden" name="permissionIds" value={id} />
            <input type="hidden" name="accessValues" value={access} />
          </span>
        ))}

        {Object.entries(groups).map(([groupName, resources]) => {
          const activeResources = resources.filter((r) => byResource[r]?.length);
          if (activeResources.length === 0) return null;

          return (
            <Card key={groupName}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{groupName}</CardTitle>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={
                        isGroupPartiallyChecked(activeResources)
                          ? "indeterminate"
                          : isGroupAllChecked(activeResources)
                      }
                      onCheckedChange={() => toggleGroup(activeResources)}
                    />
                    Toggle all
                  </label>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <table className="w-full text-sm">
                  <tbody>
                    {activeResources.map((resource) => {
                      const perms = byResource[resource];
                      return (
                        <tr key={resource} className="border-t first:border-0">
                          <td className="py-2 pr-4 font-medium text-foreground capitalize whitespace-nowrap align-top w-40">
                            {resource.replace("-", " ")}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {perms.map((perm) => {
                                const isChecked = assignments.has(perm.id);
                                const access = assignments.get(perm.id) ?? "any";
                                return (
                                  <div key={perm.id} className="inline-flex items-center gap-1.5">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggle(perm.id)}
                                      />
                                      <span className="text-muted-foreground">{perm.action}</span>
                                    </label>
                                    {isChecked && (
                                      <select
                                        value={access}
                                        onChange={(e) => setAccess(perm.id, e.target.value)}
                                        className="h-5 rounded border border-input bg-background px-1 text-xs text-muted-foreground focus:border-ring focus:outline-none"
                                      >
                                        <option value="any">any</option>
                                        <option value="own">own</option>
                                      </select>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}

        <div className="flex gap-3 pt-2">
          <Button type="submit">Save Permissions</Button>
          <Button type="button" variant="outline" asChild>
            <Link to={cancelUrl}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </div>
  );
}
