import { requireAuth } from "~/utils/auth/require-auth.server";
import {
  TableSkeleton,
  FormSkeleton,
  CardGridSkeleton,
  DashboardSkeleton,
  DesignerSkeleton,
} from "~/components/skeletons";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useState } from "react";
import type { Route } from "./+types/preview-components";

export const handle = { breadcrumb: "Preview Components" };

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return {};
}

type SkeletonVariant = "table" | "form" | "card-grid" | "dashboard" | "designer";

export default function PreviewComponentsPage() {
  const [activeVariant, setActiveVariant] = useState<SkeletonVariant>("table");

  const variants: { id: SkeletonVariant; label: string }[] = [
    { id: "table", label: "Table" },
    { id: "form", label: "Form" },
    { id: "card-grid", label: "Card Grid" },
    { id: "dashboard", label: "Dashboard" },
    { id: "designer", label: "Designer" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Component Preview</h2>
        <p className="text-sm text-muted-foreground">
          A developer utility page to preview all skeleton loading states and UI components.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loading Skeletons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            {variants.map((v) => (
              <Button
                key={v.id}
                variant={activeVariant === v.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveVariant(v.id)}
              >
                {v.label}
              </Button>
            ))}
          </div>

          <div className="rounded-lg border p-4">
            {activeVariant === "table" && <TableSkeleton columns={5} />}
            {activeVariant === "form" && <FormSkeleton />}
            {activeVariant === "card-grid" && <CardGridSkeleton />}
            {activeVariant === "dashboard" && <DashboardSkeleton />}
            {activeVariant === "designer" && <DesignerSkeleton />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Button Variants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
