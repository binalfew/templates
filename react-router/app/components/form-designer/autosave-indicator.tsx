import type { AutosaveStatus } from "~/hooks/use-autosave";
import { cn } from "~/lib/utils";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
}

const statusConfig: Record<AutosaveStatus, { color: string; text: string }> = {
  saved: { color: "bg-green-500", text: "Saved" },
  saving: { color: "bg-yellow-500 animate-pulse", text: "Saving..." },
  unsaved: { color: "bg-orange-500", text: "Unsaved changes" },
  error: { color: "bg-red-500", text: "Save failed" },
};

export function AutosaveIndicator({ status, lastSavedAt }: AutosaveIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("inline-block size-2 rounded-full", config.color)} />
      <span>{config.text}</span>
      {status === "saved" && lastSavedAt && (
        <span className="hidden sm:inline">
          at {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}
