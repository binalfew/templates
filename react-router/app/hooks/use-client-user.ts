import { useRouteLoaderData } from "react-router";
import type { ClientUser } from "~/lib/permissions";

/**
 * Access the client-safe user from the tenant layout loader.
 * Use with `userHasPermission`, `userHasRole`, `userIsGlobalAdmin` from `~/lib/permissions`.
 */
export function useClientUser(): ClientUser | null {
  const data = useRouteLoaderData("routes/$tenant/_layout") as
    | { clientUser: ClientUser }
    | undefined;
  return data?.clientUser ?? null;
}
