import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { EnumOptionsEditor, type EnumOption } from "./EnumOptionsEditor";

interface TypeConfigPanelProps {
  dataType: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function TypeConfigPanel({ dataType, config, onChange }: TypeConfigPanelProps) {
  const set = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  const numVal = (key: string): string => {
    const v = config[key];
    return v != null ? String(v) : "";
  };

  const strVal = (key: string): string => {
    const v = config[key];
    return typeof v === "string" ? v : "";
  };

  switch (dataType) {
    case "TEXT":
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="config-maxLength">Max Length</Label>
            <Input
              id="config-maxLength"
              type="number"
              value={numVal("maxLength")}
              onChange={(e) =>
                set("maxLength", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="e.g. 100"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-minLength">Min Length</Label>
            <Input
              id="config-minLength"
              type="number"
              value={numVal("minLength")}
              onChange={(e) =>
                set("minLength", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="e.g. 1"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-pattern">Regex Pattern</Label>
            <Input
              id="config-pattern"
              value={strVal("pattern")}
              onChange={(e) => set("pattern", e.target.value || undefined)}
              placeholder="e.g. ^[A-Z]{2}\\d+"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-placeholder">Placeholder</Label>
            <Input
              id="config-placeholder"
              value={strVal("placeholder")}
              onChange={(e) => set("placeholder", e.target.value || undefined)}
              placeholder="e.g. Enter value..."
              className="mt-1"
            />
          </div>
        </div>
      );

    case "LONG_TEXT":
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="config-maxLength">Max Length</Label>
            <Input
              id="config-maxLength"
              type="number"
              value={numVal("maxLength")}
              onChange={(e) =>
                set("maxLength", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="e.g. 500"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-rows">Rows</Label>
            <Input
              id="config-rows"
              type="number"
              value={numVal("rows")}
              onChange={(e) => set("rows", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 4"
              className="mt-1"
            />
          </div>
        </div>
      );

    case "NUMBER":
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="config-min">Min</Label>
            <Input
              id="config-min"
              type="number"
              value={numVal("min")}
              onChange={(e) => set("min", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 0"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-max">Max</Label>
            <Input
              id="config-max"
              type="number"
              value={numVal("max")}
              onChange={(e) => set("max", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 999"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-step">Step</Label>
            <Input
              id="config-step"
              type="number"
              value={numVal("step")}
              onChange={(e) => set("step", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 1"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-placeholder">Placeholder</Label>
            <Input
              id="config-placeholder"
              value={strVal("placeholder")}
              onChange={(e) => set("placeholder", e.target.value || undefined)}
              placeholder="e.g. Enter number"
              className="mt-1"
            />
          </div>
        </div>
      );

    case "DATE":
    case "DATETIME":
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="config-minDate">Min Date</Label>
            <Input
              id="config-minDate"
              type="date"
              value={strVal("minDate")}
              onChange={(e) => set("minDate", e.target.value || undefined)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-maxDate">Max Date</Label>
            <Input
              id="config-maxDate"
              type="date"
              value={strVal("maxDate")}
              onChange={(e) => set("maxDate", e.target.value || undefined)}
              className="mt-1"
            />
          </div>
        </div>
      );

    case "ENUM":
    case "MULTI_ENUM":
      return (
        <EnumOptionsEditor
          options={(config.options as EnumOption[]) ?? []}
          onChange={(options) => set("options", options)}
        />
      );

    case "FILE":
    case "IMAGE":
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="config-accept">Accepted File Types</Label>
            <Input
              id="config-accept"
              value={strVal("accept")}
              onChange={(e) => set("accept", e.target.value || undefined)}
              placeholder={dataType === "IMAGE" ? "image/*" : ".pdf,.doc,.docx"}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="config-maxSizeMB">Max Size (MB)</Label>
            <Input
              id="config-maxSizeMB"
              type="number"
              value={numVal("maxSizeMB")}
              onChange={(e) =>
                set("maxSizeMB", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="e.g. 10"
              className="mt-1"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
