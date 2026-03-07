import { useEffect, useState, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/misc";

const AUTO_DISMISS_MS = 30_000;

export function SwUpdatePrompt() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 300);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setRegistration(reg);
            setVisible(true);
          }
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  function handleUpdate() {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    dismiss();
    window.location.reload();
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg transition-all duration-300",
        exiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
      <p className="pr-6 text-sm font-medium">Update Available</p>
      <p className="mt-1 text-xs text-muted-foreground">
        A new version is available. Refresh to get the latest updates.
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={dismiss}>
          Later
        </Button>
        <Button size="sm" onClick={handleUpdate}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Update Now
        </Button>
      </div>
    </div>
  );
}
