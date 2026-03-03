import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import { initSentryClient, captureException as captureClientException } from "~/lib/sentry.client";
import { useNonce } from "~/lib/nonce-provider";
import { getTheme } from "~/lib/theme.server";
import { useOptimisticThemeMode } from "~/routes/resources/theme-switch";
import { initI18n, getLanguageDir } from "~/lib/i18n";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import type { Theme } from "~/lib/theme.server";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

function getLanguageFromCookie(request: Request): string {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/i18n_lang=([a-z]{2})/);
  return match?.[1] ?? "en";
}

export async function loader({ request }: Route.LoaderArgs) {
  const pwaEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.PWA);

  return {
    sentryDsn: process.env.SENTRY_DSN || "",
    theme: getTheme(request),
    language: getLanguageFromCookie(request),
    pwaEnabled,
  };
}

function useThemeClass(): string {
  const data = useRouteLoaderData("root") as { theme: Theme | null } | undefined;
  const optimisticMode = useOptimisticThemeMode();
  if (optimisticMode) {
    return optimisticMode === "system" ? "" : optimisticMode;
  }
  return data?.theme ?? "";
}

function useLanguage(): string {
  const data = useRouteLoaderData("root") as { language: string } | undefined;
  return data?.language ?? "en";
}

function usePwaEnabled(): boolean {
  const data = useRouteLoaderData("root") as { pwaEnabled: boolean } | undefined;
  return data?.pwaEnabled ?? false;
}

function useBrandTheme(): string {
  const matches = useMatches();
  for (const match of matches) {
    const matchData = match.data as any;
    if (matchData?.tenant?.brandTheme) {
      return matchData.tenant.brandTheme;
    }
  }
  return "";
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  const themeClass = useThemeClass();
  const language = useLanguage();
  const dir = getLanguageDir(language);
  const pwaEnabled = usePwaEnabled();
  const brandTheme = useBrandTheme();

  // Initialize i18n with server-detected language
  initI18n(language);

  return (
    <html
      lang={language}
      dir={dir}
      className={themeClass}
      data-brand={brandTheme || undefined}
      data-pwa={pwaEnabled ? "true" : undefined}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {pwaEnabled && (
          <>
            <link rel="manifest" href="/manifest.json" />
            <meta name="theme-color" content="#0f172a" />
            <meta name="mobile-web-app-capable" content="yes" />
            <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          </>
        )}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData("root") as { sentryDsn?: string } | undefined;

  useEffect(() => {
    if (data?.sentryDsn) {
      initSentryClient(data.sentryDsn);
    }
  }, [data?.sentryDsn]);

  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  useEffect(() => {
    if (error && !(error instanceof Response) && !isRouteErrorResponse(error)) {
      captureClientException(error);
    }
  }, [error]);

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
