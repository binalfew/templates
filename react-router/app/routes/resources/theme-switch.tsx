import { data, useFetcher, useFetchers, useRouteLoaderData } from "react-router";
import { z } from "zod";
import { Moon, Sun, Monitor } from "lucide-react";
import { type Theme, setTheme } from "~/lib/theme.server";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/theme-switch";

const ThemeFormSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const result = ThemeFormSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return data({ success: false }, { status: 400 });
  }

  return data({ success: true }, { headers: { "Set-Cookie": setTheme(result.data.theme) } });
}

export function useOptimisticThemeMode() {
  const fetchers = useFetchers();
  const themeFetcher = fetchers.find((f) => f.formAction === "/resources/theme-switch");

  if (themeFetcher?.formData) {
    const result = ThemeFormSchema.safeParse(Object.fromEntries(themeFetcher.formData));
    if (result.success) {
      return result.data.theme;
    }
  }
}

export function useTheme(): Theme {
  const rootData = useRouteLoaderData("root") as { theme: Theme | null } | undefined;
  const optimisticMode = useOptimisticThemeMode();
  if (optimisticMode) {
    return optimisticMode === "system" ? "light" : optimisticMode;
  }
  return rootData?.theme ?? "light";
}

export function ThemeSwitch({ userPreference }: { userPreference?: Theme | null }) {
  const fetcher = useFetcher<typeof action>();

  const optimisticMode = useOptimisticThemeMode();
  const mode = optimisticMode ?? userPreference ?? "system";
  const nextMode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";

  const icon = {
    light: <Sun className="size-4" />,
    dark: <Moon className="size-4" />,
    system: <Monitor className="size-4" />,
  };

  return (
    <fetcher.Form method="POST" action="/resources/theme-switch">
      <input type="hidden" name="theme" value={nextMode} />
      <Button type="submit" variant="ghost" size="icon" className="size-8">
        {icon[mode]}
        <span className="sr-only">Toggle theme ({mode === "system" ? "System" : mode})</span>
      </Button>
    </fetcher.Form>
  );
}
