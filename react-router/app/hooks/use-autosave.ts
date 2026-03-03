import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "saved" | "saving" | "unsaved" | "error";

interface UseAutosaveOptions {
  url: string;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutosave({ url, debounceMs = 2000, enabled = true }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  const save = useCallback(
    async (data: unknown) => {
      if (!enabled) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("saving");
      try {
        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Save failed: ${response.status}`);

        setStatus("saved");
        setLastSavedAt(new Date());
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setStatus("error");
        }
      }
    },
    [url, enabled],
  );

  const debouncedSave = useCallback(
    (data: unknown) => {
      setStatus("unsaved");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(data), debounceMs);
    },
    [save, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { status, lastSavedAt, save, debouncedSave };
}
