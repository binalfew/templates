import * as cookie from "cookie";
import { createCookie } from "react-router";
import { prisma } from "~/utils/db/db.server";

const cookieName = "theme";
export type Theme = "light" | "dark";

export function getTheme(request: Request): Theme | null {
  const cookieHeader = request.headers.get("cookie");
  const parsed = cookieHeader ? cookie.parse(cookieHeader)[cookieName] : null;
  if (parsed === "light" || parsed === "dark") return parsed;
  return null;
}

export function setTheme(theme: Theme | "system") {
  if (theme === "system") {
    return cookie.serialize(cookieName, "", { path: "/", maxAge: -1 });
  }
  return cookie.serialize(cookieName, theme, {
    path: "/",
    maxAge: 31_536_000,
  });
}

/**
 * Cookie that remembers the last visited tenant slug for brand theming
 * on non-tenant pages (e.g. login).
 */
export const brandCookie = createCookie("brand", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365, // 1 year
});

/**
 * Resolve the brand theme for non-tenant routes (e.g. login page).
 * Priority: ?tenant= query param > brand_tenant cookie.
 * Returns the tenant's brandTheme string, or "" if not found.
 */
export async function resolveBrandTheme(request: Request): Promise<string> {
  const slug = await brandCookie.parse(request.headers.get("Cookie"));

  if (!slug) return "";

  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { brandTheme: true },
  });

  return tenant?.brandTheme ?? "";
}
