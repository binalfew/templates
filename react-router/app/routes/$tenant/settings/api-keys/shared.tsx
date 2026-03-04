import { useState } from "react";
import { Button } from "~/components/ui/button";

// --- Badge variant map for API key status ---

export const API_KEY_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ROTATED: "secondary",
  REVOKED: "destructive",
  EXPIRED: "outline",
};

// --- Raw key alert (shown once after create/rotate) ---

export function RawKeyAlert({ rawKey, title, children }: {
  rawKey: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
          {title ?? "Save your API key now"}
        </h3>
        <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
          This is the only time you will see this key. Copy it and store it securely.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded bg-yellow-100 p-2 text-xs font-mono break-all dark:bg-yellow-900">
            {rawKey}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(rawKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
