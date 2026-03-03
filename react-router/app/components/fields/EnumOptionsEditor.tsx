import { useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export interface EnumOption {
  value: string;
  label: string;
}

interface EnumOptionsEditorProps {
  options: EnumOption[];
  onChange: (options: EnumOption[]) => void;
}

function labelToValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

export function EnumOptionsEditor({ options, onChange }: EnumOptionsEditorProps) {
  const [newLabel, setNewLabel] = useState("");

  const addOption = useCallback(() => {
    const label = newLabel.trim();
    if (!label) return;
    const value = labelToValue(label);
    if (options.some((o) => o.value === value)) return;
    onChange([...options, { value, label }]);
    setNewLabel("");
  }, [newLabel, options, onChange]);

  const removeOption = useCallback(
    (index: number) => {
      onChange(options.filter((_, i) => i !== index));
    },
    [options, onChange],
  );

  const moveOption = useCallback(
    (index: number, direction: "up" | "down") => {
      const newOptions = [...options];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= newOptions.length) return;
      [newOptions[index], newOptions[swapIndex]] = [newOptions[swapIndex], newOptions[index]];
      onChange(newOptions);
    },
    [options, onChange],
  );

  const updateOptionLabel = useCallback(
    (index: number, label: string) => {
      const newOptions = [...options];
      newOptions[index] = { ...newOptions[index], label, value: labelToValue(label) };
      onChange(newOptions);
    },
    [options, onChange],
  );

  return (
    <div className="space-y-3">
      <Label>Options</Label>
      {options.length > 0 && (
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={option.label}
                onChange={(e) => updateOptionLabel(index, e.target.value)}
                className="flex-1"
                placeholder="Option label"
              />
              <span className="text-xs text-muted-foreground min-w-[80px] truncate">
                {option.value}
              </span>
              <div className="flex gap-0.5">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveOption(index, "up")}
                    title="Move up"
                  >
                    &#8593;
                  </Button>
                )}
                {index < options.length - 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveOption(index, "down")}
                    title="Move down"
                  >
                    &#8595;
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeOption(index)}
                  title="Remove"
                >
                  &#10005;
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New option label"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          Add
        </Button>
      </div>
    </div>
  );
}
