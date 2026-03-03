import { useState } from "react";
import { Download } from "lucide-react";
import { requirePermission } from "~/lib/auth/require-auth.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import type { Route } from "./+types/export";

export const handle = { breadcrumb: "Export" };

export async function loader({ request }: Route.LoaderArgs) {
  await requirePermission(request, "settings", "manage");
  return {};
}

export default function ExportPage() {
  const [entity, setEntity] = useState("users");
  const [format, setFormat] = useState("csv");

  function handleExport() {
    window.location.href = `/resources/export-download?entity=${entity}&format=${format}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Export Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download your data in CSV or JSON format.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="entity">Entity</Label>
              <NativeSelect
                id="entity"
                name="entity"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              >
                <NativeSelectOption value="users">Users</NativeSelectOption>
                <NativeSelectOption value="roles">Roles</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="format">Format</Label>
              <NativeSelect
                id="format"
                name="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <NativeSelectOption value="csv">CSV</NativeSelectOption>
                <NativeSelectOption value="json">JSON</NativeSelectOption>
              </NativeSelect>
            </div>

            <Button type="button" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
