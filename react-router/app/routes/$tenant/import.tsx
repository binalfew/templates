import { data, Form, useActionData } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { Upload } from "lucide-react";
import { requirePermission } from "~/lib/require-auth.server";
import { parseCsv, parseJson, importData } from "~/services/data-import.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import type { Route } from "./+types/import";

export const handle = { breadcrumb: "Import" };

export async function loader({ request }: Route.LoaderArgs) {
  await requirePermission(request, "settings", "manage");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "No tenant", { status: 403 });

  const formData = await request.formData();
  const entity = formData.get("entity") as string;
  const dryRun = formData.get("dryRun") === "true";
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return data({ error: "Please select a file" }, { status: 400 });
  }

  const content = await file.text();
  let rows;
  try {
    if (file.name.endsWith(".json")) {
      rows = parseJson(content);
    } else {
      rows = parseCsv(content);
    }
  } catch {
    return data({ error: "Failed to parse file" }, { status: 400 });
  }

  const result = await importData({
    entity,
    tenantId,
    rows,
    dryRun,
    userId: user.id,
  });

  return data({ result, dryRun });
}

export default function ImportPage() {
  const actionData = useActionData<typeof action>();
  const result = actionData && "result" in actionData ? actionData.result : null;
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Import Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV or JSON file to import data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Options</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" encType="multipart/form-data">
            <div className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="entity">Entity</Label>
                <NativeSelect id="entity" name="entity">
                  <NativeSelectOption value="users">Users</NativeSelectOption>
                  <NativeSelectOption value="roles">Roles</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="file">File (CSV or JSON)</Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".csv,.json"
                  className="text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" name="dryRun" value="true" variant="outline">
                  Preview (Dry Run)
                </Button>
                <Button type="submit" name="dryRun" value="false">
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              {actionData && "dryRun" in actionData && actionData.dryRun
                ? "Preview Results"
                : "Import Results"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>Total rows: {result.totalRows}</p>
              <p>Valid rows: {result.validRows}</p>
              <p>Error rows: {result.errorRows}</p>
              {!("dryRun" in actionData! && actionData.dryRun) && (
                <p className="font-medium">Imported: {result.imported}</p>
              )}
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-destructive">Errors:</p>
                  <ul className="mt-1 space-y-1">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i} className="text-destructive">
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                    {result.errors.length > 20 && (
                      <li className="text-muted-foreground">
                        ... and {result.errors.length - 20} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
