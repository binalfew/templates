import { redirect } from "react-router";
import type { Route } from "./+types/index";

export function loader({ params }: Route.LoaderArgs) {
  return redirect(`/${params.tenant}/security/users`);
}
