import { useState } from "react";
import { Download, FileDown } from "lucide-react";
import { requirePermission } from "~/lib/auth/require-auth.server";
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
import type { Route } from "./+types/export";

export const handle = { breadcrumb: "Export" };

const ENTITIES = [
  { value: "users", label: "Users" },
  { value: "roles", label: "Roles" },
  { value: "countries", label: "Countries" },
  { value: "titles", label: "Titles" },
  { value: "languages", label: "Languages" },
  { value: "currencies", label: "Currencies" },
  { value: "document-types", label: "Document Types" },
] as const;

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

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export Configuration
          </CardTitle>
          <CardDescription>
            Select the entity type and format, then download your data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="entity">Entity</Label>
                <NativeSelect
                  id="entity"
                  name="entity"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  className="w-full"
                >
                  {ENTITIES.map((e) => (
                    <NativeSelectOption key={e.value} value={e.value}>
                      {e.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  Choose the type of data you want to export.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="format">Format</Label>
                <NativeSelect
                  id="format"
                  name="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="csv">CSV (.csv)</NativeSelectOption>
                  <NativeSelectOption value="json">JSON (.json)</NativeSelectOption>
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  CSV is best for spreadsheets, JSON for programmatic use.
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" onClick={handleExport} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
