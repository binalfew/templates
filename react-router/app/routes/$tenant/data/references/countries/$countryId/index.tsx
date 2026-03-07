import { Link, useLoaderData } from "react-router";
import { Globe, ArrowLeft, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { getCountry } from "~/services/reference-data.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);
  const country = await getCountry(params.countryId);
  return { country };
}

export default function CountryDetailPage() {
  const { country } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const basePath = `${base}/data/references/countries`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {country.flag && <span className="text-2xl">{country.flag}</span>}
          <Globe className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{country.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={basePath}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${basePath}/${country.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${basePath}/${country.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Country Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Code</span>
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {country.code}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{country.name}</span>
          </div>
          {country.alpha3 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Alpha-3</span>
              <span>{country.alpha3}</span>
            </div>
          )}
          {country.numericCode && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Numeric Code</span>
              <span>{country.numericCode}</span>
            </div>
          )}
          {country.phoneCode && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone Code</span>
              <span>{country.phoneCode}</span>
            </div>
          )}
          {country.flag && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flag</span>
              <span className="text-xl">{country.flag}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sort Order</span>
            <span>{country.sortOrder}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={country.isActive ? "default" : "secondary"}>
              {country.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(country.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated</span>
            <span>{new Date(country.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
