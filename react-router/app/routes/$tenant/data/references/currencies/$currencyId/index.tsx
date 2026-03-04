import { Link, useLoaderData } from "react-router";
import { Banknote, ArrowLeft, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { getCurrency } from "~/services/reference-data.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);
  const currency = await getCurrency(params.currencyId);
  return { currency };
}

export default function CurrencyDetailPage() {
  const { currency } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const basePath = `${base}/data/references/currencies`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Banknote className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{currency.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={basePath}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${basePath}/${currency.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${basePath}/${currency.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currency Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Code</span>
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {currency.code}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{currency.name}</span>
          </div>
          {currency.symbol && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Symbol</span>
              <span className="text-lg">{currency.symbol}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Decimal Digits</span>
            <span>{currency.decimalDigits}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sort Order</span>
            <span>{currency.sortOrder}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={currency.isActive ? "default" : "secondary"}>
              {currency.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(currency.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated</span>
            <span>{new Date(currency.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
