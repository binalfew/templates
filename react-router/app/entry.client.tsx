import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});

// ─── Service Worker Registration ──────────────────────────
// Skip in development — the SW intercepts requests and breaks Vite HMR.
// Registration is triggered by the root loader setting data-pwa="true" on <html>.
if (!import.meta.env.DEV) {
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    const pwaEnabled = document.documentElement.dataset.pwa === "true";
    if (!pwaEnabled) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registered with scope:", registration.scope);
      })
      .catch((error) => {
        console.error("[SW] Registration failed:", error);
      });
  }

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker);
  }
}
