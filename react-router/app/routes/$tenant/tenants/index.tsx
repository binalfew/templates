import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { Building2, Plus, Search, ExternalLink } from "lucide-react";

export const handle = { breadcrumb: "Tenants" };

import { requireAnyRole } from "~/lib/require-auth.server";
import { listTenants } from "~/services/tenants.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnyRole(request, ["ADMIN"]);

  const tenants = await listTenants();
  return { tenants };
}

const planVariant: Record<string, "default" | "secondary" | "outline"> = {
  free: "outline",
  starter: "secondary",
  professional: "default",
  enterprise: "default",
};

export default function TenantsListPage() {
  const { tenants } = useLoaderData<typeof loader>();
  const basePrefix = useBasePrefix();
  const [search, setSearch] = useState("");

  const filtered = tenants.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tenants</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage organizations and their subscription plans.
          </p>
        </div>
        <Button asChild>
          <Link to={`${basePrefix}/tenants/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Tenant
          </Link>
        </Button>
      </div>

      {tenants.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No tenants found"
          description="Tenants will appear here once they are created."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching tenants"
          description="Try adjusting your search terms."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tenant) => (
            <div key={tenant.id} className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted overflow-hidden">
                  {tenant.logoUrl ? (
                    <img
                      src={tenant.logoUrl}
                      alt={tenant.name}
                      className="size-full object-contain p-0.5"
                    />
                  ) : (
                    <Building2 className="size-5 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`${basePrefix}/tenants/${tenant.id}`}
                        className="font-semibold text-foreground hover:underline truncate block"
                      >
                        {tenant.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">/{tenant.slug}</p>
                    </div>
                    <Badge
                      variant={planVariant[tenant.subscriptionPlan] ?? "outline"}
                      className="capitalize shrink-0"
                    >
                      {tenant.subscriptionPlan}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>{tenant.email}</p>
                {tenant.website && (
                  <a
                    href={tenant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {tenant.website.replace(/^https?:\/\//, "")}
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {tenant._count.users} user{tenant._count.users !== 1 ? "s" : ""}
                </span>
                <span className="text-border">|</span>
                <span>
                  {tenant._count.roles} role{tenant._count.roles !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Created {new Date(tenant.createdAt).toLocaleDateString()}
              </div>

              <div className="mt-4 flex items-center gap-3 text-sm">
                <Link
                  to={`${basePrefix}/tenants/${tenant.id}`}
                  className="text-primary hover:underline"
                >
                  View
                </Link>
                <Link
                  to={`${basePrefix}/tenants/${tenant.id}/edit`}
                  className="text-primary hover:underline"
                >
                  Edit
                </Link>
                <Link
                  to={`${basePrefix}/tenants/${tenant.id}/delete`}
                  className="text-destructive hover:underline"
                >
                  Delete
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
