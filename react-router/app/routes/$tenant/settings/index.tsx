import { requireAnyRole } from "~/lib/auth/require-auth.server";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Settings" };

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnyRole(request, ["ADMIN", "TENANT_ADMIN"]);
  return {};
}

export default function SettingsIndex() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your application settings.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold">General Settings</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Application settings will appear here. Customize this page for your needs.
        </p>
      </div>
    </div>
  );
}
