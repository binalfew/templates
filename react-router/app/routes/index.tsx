import { redirect } from "react-router";
import { getUserId, getDefaultRedirect } from "~/lib/auth/session.server";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) {
    const redirectUrl = await getDefaultRedirect(userId);
    throw redirect(redirectUrl);
  }
  throw redirect("/auth/login");
}

export default function Index() {
  return null;
}
