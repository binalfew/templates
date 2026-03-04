import { Link, useLoaderData } from "react-router";
import { FileText, ArrowLeft, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireUser } from "~/lib/auth/session.server";
import { getDocumentType } from "~/services/reference-data.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const documentType = await getDocumentType(params.documentTypeId);
  return { documentType };
}

export default function DocumentTypeDetailPage() {
  const { documentType } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const basePath = `${base}/data/references/document-types`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{documentType.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={basePath}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${basePath}/${documentType.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${basePath}/${documentType.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Type Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Code</span>
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {documentType.code}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{documentType.name}</span>
          </div>
          {documentType.category && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span>{documentType.category}</span>
            </div>
          )}
          {documentType.description && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Description</span>
              <span className="max-w-xs text-right">{documentType.description}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sort Order</span>
            <span>{documentType.sortOrder}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={documentType.isActive ? "default" : "secondary"}>
              {documentType.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(documentType.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated</span>
            <span>{new Date(documentType.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
