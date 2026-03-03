import { data, Form, useLoaderData } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { Upload, Trash2, FileText } from "lucide-react";
import { requireAuth, requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { prisma } from "~/lib/db/db.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { EmptyState } from "~/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { Route } from "./+types/uploads";

export const handle = { breadcrumb: "File Uploads" };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FILE_UPLOADS);

  const files = await prisma.uploadedFile.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return { files };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "No tenant", { status: 403 });

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  if (_action === "delete") {
    const fileId = formData.get("fileId") as string;
    await prisma.uploadedFile.delete({ where: { id: fileId } });
    return { ok: true };
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export default function UploadsPage() {
  const { files } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">File Uploads</h2>
          <p className="text-sm text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""} uploaded</p>
        </div>
      </div>
      <Separator />

      {files.length === 0 ? (
        <EmptyState icon={Upload} title="No files" description="Files will appear here when uploaded through the API or forms." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    {file.originalName}
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{file.mimeType}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatFileSize(file.sizeBytes)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(file.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="fileId" value={file.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </Form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
