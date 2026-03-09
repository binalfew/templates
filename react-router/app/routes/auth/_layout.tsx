import { Outlet } from "react-router";
import { resolveBrandTheme } from "~/utils/theme.server";
import { BrandedPanel, RightPanel } from "~/components/auth/auth-layout";
import type { Route } from "./+types/_layout";

export async function loader({ request }: Route.LoaderArgs) {
  const brandTheme = await resolveBrandTheme(request);
  return { brandTheme };
}

export default function AuthLayout() {
  return (
    <div className="flex min-h-svh">
      <BrandedPanel />
      <RightPanel>
        <Outlet />
      </RightPanel>
    </div>
  );
}
