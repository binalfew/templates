import { Link, useLoaderData } from "react-router";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Shield,
  ExternalLink,
} from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { getTenantDetail } from "~/services/tenants.server";
import { BRAND_THEMES } from "~/lib/schemas/tenant";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, ["ADMIN"]);

  const { tenant } = await getTenantDetail(params.tenantId);
  return { tenant };
}

const planVariant: Record<string, "default" | "secondary" | "outline"> = {
  free: "outline",
  starter: "secondary",
  professional: "default",
  enterprise: "default",
};

export default function TenantDetailPage() {
  const { tenant } = useLoaderData<typeof loader>();
  const basePrefix = useBasePrefix();

  const brandLabel =
    BRAND_THEMES.find((t) => t.value === (tenant.brandTheme ?? ""))?.label ?? "Default";

  const address = [tenant.address, tenant.city, tenant.state, tenant.zip, tenant.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{tenant.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${basePrefix}/tenants`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${basePrefix}/tenants/${tenant.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${basePrefix}/tenants/${tenant.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General Info */}
        <Card>
          <CardHeader>
            <CardTitle>General Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">/{tenant.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subscription Plan</span>
              <Badge
                variant={planVariant[tenant.subscriptionPlan] ?? "outline"}
                className="capitalize"
              >
                {tenant.subscriptionPlan}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                {tenant.email}
              </a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="size-4 text-muted-foreground shrink-0" />
              <span>{tenant.phone}</span>
            </div>
            {tenant.website && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="size-4 text-muted-foreground shrink-0" />
                <a
                  href={tenant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {tenant.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to={`${basePrefix}/security/users`}
                className="rounded-lg border p-4 text-center hover:bg-muted/50 transition-colors"
              >
                <Users className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{tenant._count.users}</p>
                <p className="text-xs text-muted-foreground">Users</p>
              </Link>
              <Link
                to={`${basePrefix}/security/roles`}
                className="rounded-lg border p-4 text-center hover:bg-muted/50 transition-colors"
              >
                <Shield className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{tenant._count.roles}</p>
                <p className="text-xs text-muted-foreground">Roles</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {tenant.logoUrl && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Logo</span>
                <div className="size-10 rounded-md border bg-muted overflow-hidden">
                  <img src={tenant.logoUrl} alt="Logo" className="size-full object-contain p-0.5" />
                </div>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Theme</span>
              <Badge variant="secondary">{brandLabel}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to={`${basePrefix}/tenants/${tenant.id}/edit`}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit Tenant
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`${basePrefix}/security/users`}>
                <Users className="mr-1.5 size-3.5" />
                Manage Users
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`${basePrefix}/security/roles`}>
                <Shield className="mr-1.5 size-3.5" />
                Manage Roles
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
