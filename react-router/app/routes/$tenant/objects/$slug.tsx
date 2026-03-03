import { data, Form, Link, useLoaderData, redirect, useParams } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { requireAuth, requireFeature } from "~/lib/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import {
  getDefinitionBySlug,
  listRecords,
  createRecord,
  deleteRecord,
  updateDefinition,
  type CustomFieldDefinition,
} from "~/services/custom-objects.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/$slug";

export const handle = { breadcrumb: "Object Detail" };

const DATA_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "EMAIL", "URL", "PHONE"] as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const definition = await getDefinitionBySlug(tenantId, params.slug!);
  const records = await listRecords(definition.id, tenantId);
  return { definition, records };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "No tenant", { status: 403 });

  const formData = await request.formData();
  const _action = formData.get("_action") as string;
  const definition = await getDefinitionBySlug(tenantId, params.slug!);

  try {
    switch (_action) {
      case "add-field": {
        const name = formData.get("fieldName") as string;
        const label = formData.get("fieldLabel") as string;
        const dataType = formData.get("fieldType") as string;
        const required = formData.get("fieldRequired") === "on";
        if (!name || !label || !dataType) return data({ error: "Name, label, and type are required" }, { status: 400 });
        const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];
        fields.push({ name, label, dataType, required });
        await updateDefinition(definition.id, { fields });
        break;
      }
      case "create-record": {
        const fields = definition.fields as unknown as CustomFieldDefinition[];
        const recordData: Record<string, unknown> = {};
        for (const field of fields) {
          const value = formData.get(`field_${field.name}`);
          if (field.dataType === "BOOLEAN") {
            recordData[field.name] = value === "on";
          } else if (field.dataType === "NUMBER") {
            recordData[field.name] = value ? Number(value) : undefined;
          } else {
            recordData[field.name] = value ?? undefined;
          }
        }
        await createRecord({ definitionId: definition.id, tenantId, data: recordData, createdBy: user.id });
        break;
      }
      case "delete-record": {
        await deleteRecord(formData.get("recordId") as string);
        break;
      }
      default:
        return data({ error: "Unknown action" }, { status: 400 });
    }
    return redirect(`/${params.tenant}/objects/${params.slug}`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function CustomObjectDetailPage() {
  const { definition, records } = useLoaderData<typeof loader>();
  const basePrefix = useBasePrefix();
  const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`${basePrefix}/objects`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 size-4" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{definition.name}</h1>
          <p className="text-sm text-muted-foreground">{definition.description || definition.slug}</p>
        </div>
      </div>
      <Separator />

      {/* Add Field */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4" /> Add Field to Schema</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="_action" value="add-field" />
            <div>
              <label htmlFor="fieldName" className="mb-1 block text-xs font-medium text-muted-foreground">Name (key)</label>
              <Input id="fieldName" name="fieldName" required placeholder="e.g. color" pattern="^[a-z][a-z0-9_]*$" className="w-40" />
            </div>
            <div>
              <label htmlFor="fieldLabel" className="mb-1 block text-xs font-medium text-muted-foreground">Label</label>
              <Input id="fieldLabel" name="fieldLabel" required placeholder="e.g. Color" className="w-40" />
            </div>
            <div>
              <label htmlFor="fieldType" className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <NativeSelect id="fieldType" name="fieldType">
                {DATA_TYPES.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="fieldRequired" name="fieldRequired" value="on" />
              <label htmlFor="fieldRequired" className="text-xs text-muted-foreground cursor-pointer">Required</label>
            </div>
            <Button type="submit" size="sm">Add Field</Button>
          </Form>
        </CardContent>
      </Card>

      {/* Schema display */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <Badge key={f.name} variant="secondary">
              {f.label} ({f.dataType}){f.required ? " *" : ""}
            </Badge>
          ))}
        </div>
      )}

      {/* Create Record */}
      {fields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Record</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="flex flex-wrap items-end gap-4">
              <input type="hidden" name="_action" value="create-record" />
              {fields.map((field) => (
                <div key={field.name}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{field.label}</label>
                  {field.dataType === "BOOLEAN" ? (
                    <Checkbox name={`field_${field.name}`} value="on" />
                  ) : (
                    <Input
                      name={`field_${field.name}`}
                      type={field.dataType === "NUMBER" ? "number" : field.dataType === "DATE" ? "date" : field.dataType === "EMAIL" ? "email" : field.dataType === "URL" ? "url" : "text"}
                      required={field.required}
                      className="w-40"
                    />
                  )}
                </div>
              ))}
              <Button type="submit" size="sm">Create</Button>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Records table */}
      {records.length === 0 ? (
        <EmptyState icon={Plus} title="No records" description="Add fields to the schema, then create records." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map((f) => <TableHead key={f.name}>{f.label}</TableHead>)}
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => {
              const recordData = record.data as Record<string, unknown>;
              return (
                <TableRow key={record.id}>
                  {fields.map((f) => (
                    <TableCell key={f.name}>
                      {recordData[f.name] === true ? "Yes" : recordData[f.name] === false ? "No" : String(recordData[f.name] ?? "")}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="delete-record" />
                      <input type="hidden" name="recordId" value={record.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </Form>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
