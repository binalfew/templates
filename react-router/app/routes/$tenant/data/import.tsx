import { useRef } from "react";
import { data, Form, useActionData, useNavigation } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { AlertCircle, CheckCircle2, Eye, FileUp, Upload } from "lucide-react";
import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { parseCsv, parseJson, importData } from "~/services/data-import.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Separator } from "~/components/ui/separator";
import type { Route } from "./+types/import";

export const handle = { breadcrumb: "Import" };

const ENTITIES = [
  { value: "users", label: "Users", description: "email, name, username, password" },
  { value: "roles", label: "Roles", description: "name, description, scope" },
  { value: "countries", label: "Countries", description: "code, name, alpha3, numericCode, phoneCode, flag" },
  { value: "titles", label: "Titles", description: "code, name" },
  { value: "languages", label: "Languages", description: "code, name, nativeName" },
  { value: "currencies", label: "Currencies", description: "code, name, symbol, decimalDigits" },
  { value: "document-types", label: "Document Types", description: "code, name, description, category" },
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_ONLY]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "No tenant", { status: 403 });

  const formData = await request.formData();
  const entity = formData.get("entity") as string;
  const dryRun = formData.get("_action") === "preview";
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return data({ error: "Please select a file to import." }, { status: 400 });
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
    return data({ error: "Failed to parse file. Ensure it is valid CSV or JSON." }, { status: 400 });
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const formRef = useRef<HTMLFormElement>(null);

  const result = actionData && "result" in actionData ? actionData.result : null;
  const error = actionData && "error" in actionData ? actionData.error : null;
  const isDryRun = actionData && "dryRun" in actionData ? actionData.dryRun : false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Import Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV or JSON file to bulk-import records into the system.
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import Configuration
          </CardTitle>
          <CardDescription>
            Select the entity type and upload your file. Use Preview to validate your data before
            committing the import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form ref={formRef} method="post" encType="multipart/form-data" className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="entity">Entity</Label>
                <NativeSelect id="entity" name="entity" className="w-full">
                  {ENTITIES.map((e) => (
                    <NativeSelectOption key={e.value} value={e.value}>
                      {e.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  Choose the type of data you want to import.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="file">File</Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".csv,.json"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:mr-3 file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-foreground file:rounded-md hover:file:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Accepted formats: CSV (.csv) or JSON (.json).
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                name="_action"
                value="preview"
                variant="outline"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                <Eye className="mr-2 h-4 w-4" />
                {isSubmitting ? "Processing..." : "Preview"}
              </Button>
              <Button
                type="submit"
                name="_action"
                value="import"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isSubmitting ? "Importing..." : "Import"}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.errorRows > 0 ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {isDryRun ? "Preview Results" : "Import Results"}
            </CardTitle>
            <CardDescription>
              {isDryRun
                ? "This is a preview only. No records were modified."
                : `Import completed. ${result.imported} record${result.imported === 1 ? "" : "s"} created.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{result.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{result.validRows}</p>
                <p className="text-xs text-muted-foreground">Valid Rows</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{result.errorRows}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {!isDryRun && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {result.imported} record{result.imported === 1 ? "" : "s"} imported successfully
                </p>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Errors ({result.errors.length})
                </p>
                <div className="max-h-60 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Row</th>
                        <th className="px-4 py-2 text-left font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.errors.slice(0, 50).map((e, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-muted-foreground">{e.row}</td>
                          <td className="px-4 py-2 text-destructive">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.errors.length > 50 && (
                    <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                      Showing 50 of {result.errors.length} errors
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
