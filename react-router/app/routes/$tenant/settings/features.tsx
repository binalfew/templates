import { useLoaderData, useFetcher } from "react-router";
import { useTranslation } from "react-i18next";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import { requireAnyRole } from "~/lib/auth/require-auth.server";

export function ErrorBoundary() {
  return <RouteErrorBoundary context="feature flags" />;
}
import { prisma } from "~/lib/db/db.server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import type { Route } from "./+types/features";

export const handle = { breadcrumb: "Features" };

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnyRole(request, ["ADMIN"]);

  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return { flags };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnyRole(request, ["ADMIN"]);

  const formData = await request.formData();
  const flagId = formData.get("flagId") as string;
  const enabled = formData.get("enabled") === "true";

  await prisma.featureFlag.update({
    where: { id: flagId },
    data: { enabled },
  });

  return { ok: true };
}

export default function FeatureFlagsPage() {
  const { t } = useTranslation("settings");
  const { flags } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  function toggleFlag(flagId: string, currentEnabled: boolean) {
    fetcher.submit(
      { flagId, enabled: String(!currentEnabled) },
      { method: "post" },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("featureFlags")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("featureFlagsDesc")}
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Toggle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No feature flags found.
                </TableCell>
              </TableRow>
            ) : (
              flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-sm">{flag.key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {flag.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={flag.enabled ? "default" : "secondary"}>
                      {flag.enabled ? t("flagEnabled") : t("flagDisabled")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => toggleFlag(flag.id, flag.enabled)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
