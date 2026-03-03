import { useCallback } from "react";
import { Plus, Trash2, Eye } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { cn } from "~/lib/utils";
import { getOperatorsForType, type OperatorInfo } from "~/lib/condition-evaluator";
import type {
  VisibilityCondition,
  SimpleCondition,
  CompoundCondition,
  ConditionOperator,
} from "~/types/form-designer";

interface FieldDefinitionLookup {
  id: string;
  label: string;
  dataType: string;
  name: string;
}

interface ConditionBuilderProps {
  condition: VisibilityCondition | undefined;
  availableFields: FieldDefinitionLookup[];
  excludeFieldId?: string;
  onChange: (condition: VisibilityCondition | undefined) => void;
}

export function ConditionBuilder({
  condition,
  availableFields,
  excludeFieldId,
  onChange,
}: ConditionBuilderProps) {
  const selectableFields = excludeFieldId
    ? availableFields.filter((f) => f.id !== excludeFieldId)
    : availableFields;

  const handleAddCondition = useCallback(() => {
    const firstField = selectableFields[0];
    const newSimple: SimpleCondition = {
      type: "simple",
      field: firstField?.id ?? "",
      operator: "eq",
      value: "",
    };

    if (!condition) {
      onChange(newSimple);
    } else if (condition.type === "simple") {
      onChange({
        type: "compound",
        operator: "and",
        conditions: [condition, newSimple],
      });
    } else {
      onChange({
        ...condition,
        conditions: [...condition.conditions, newSimple],
      });
    }
  }, [condition, selectableFields, onChange]);

  const handleClearAll = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  if (!condition) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-dashed p-4 text-center">
          <Eye className="mx-auto mb-2 size-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            No visibility conditions set.
            <br />
            This element is always visible.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 text-xs"
            onClick={handleAddCondition}
            disabled={selectableFields.length === 0}
          >
            <Plus className="mr-1 size-3" />
            Add condition
          </Button>
          {selectableFields.length === 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">Add fields to the form first</p>
          )}
        </div>
      </div>
    );
  }

  if (condition.type === "simple") {
    return (
      <div className="space-y-3">
        <ConditionPreview condition={condition} availableFields={availableFields} />
        <SimpleConditionRow
          condition={condition}
          availableFields={selectableFields}
          onChange={(updated) => onChange(updated)}
          onRemove={handleClearAll}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={handleAddCondition}
          disabled={selectableFields.length === 0}
        >
          <Plus className="mr-1 size-3" />
          Add condition
        </Button>
      </div>
    );
  }

  return (
    <CompoundConditionEditor
      condition={condition}
      availableFields={selectableFields}
      allFields={availableFields}
      onChange={onChange}
      onClear={handleClearAll}
      onAddCondition={handleAddCondition}
    />
  );
}

function CompoundConditionEditor({
  condition,
  availableFields,
  allFields,
  onChange,
  onClear,
  onAddCondition,
}: {
  condition: CompoundCondition;
  availableFields: FieldDefinitionLookup[];
  allFields: FieldDefinitionLookup[];
  onChange: (c: VisibilityCondition | undefined) => void;
  onClear: () => void;
  onAddCondition: () => void;
}) {
  const handleToggleOperator = () => {
    onChange({
      ...condition,
      operator: condition.operator === "and" ? "or" : "and",
    });
  };

  const handleUpdateCondition = (index: number, updated: SimpleCondition) => {
    const newConditions = [...condition.conditions];
    newConditions[index] = updated;
    onChange({ ...condition, conditions: newConditions });
  };

  const handleRemoveCondition = (index: number) => {
    const remaining = condition.conditions.filter((_, i) => i !== index);
    if (remaining.length === 0) {
      onClear();
    } else if (remaining.length === 1) {
      onChange(remaining[0]);
    } else {
      onChange({ ...condition, conditions: remaining });
    }
  };

  return (
    <div className="space-y-3">
      <ConditionPreview condition={condition} availableFields={allFields} />
      <div className="space-y-2">
        {condition.conditions.map((c, i) => (
          <div key={i}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-dashed" />
                <button
                  onClick={handleToggleOperator}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase transition-colors",
                    condition.operator === "and"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                  )}
                >
                  {condition.operator}
                </button>
                <div className="flex-1 border-t border-dashed" />
              </div>
            )}
            {c.type === "simple" && (
              <SimpleConditionRow
                condition={c}
                availableFields={availableFields}
                onChange={(updated) => handleUpdateCondition(i, updated)}
                onRemove={() => handleRemoveCondition(i)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={onAddCondition}
          disabled={availableFields.length === 0}
        >
          <Plus className="mr-1 size-3" />
          Add condition
        </Button>
        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={onClear}>
          Clear all
        </Button>
      </div>
    </div>
  );
}

function SimpleConditionRow({
  condition,
  availableFields,
  onChange,
  onRemove,
}: {
  condition: SimpleCondition;
  availableFields: FieldDefinitionLookup[];
  onChange: (updated: SimpleCondition) => void;
  onRemove: () => void;
}) {
  const selectedField = availableFields.find((f) => f.id === condition.field);
  const operators = getOperatorsForType(selectedField?.dataType ?? "TEXT");
  const currentOp = operators.find((o) => o.value === condition.operator);
  const needsValue = currentOp?.needsValue ?? true;

  const handleFieldChange = (fieldId: string) => {
    const fd = availableFields.find((f) => f.id === fieldId);
    const newOps = getOperatorsForType(fd?.dataType ?? "TEXT");
    const opStillValid = newOps.some((o) => o.value === condition.operator);
    onChange({
      ...condition,
      field: fieldId,
      operator: opStillValid ? condition.operator : (newOps[0]?.value ?? "eq"),
      value: "",
    });
  };

  const handleOperatorChange = (op: ConditionOperator) => {
    const opInfo = operators.find((o) => o.value === op);
    onChange({
      ...condition,
      operator: op,
      value: opInfo?.needsValue ? condition.value : undefined,
    });
  };

  return (
    <div className="rounded border bg-muted/30 p-2 space-y-2">
      <div className="flex items-center gap-1">
        <label className="text-[10px] font-medium text-muted-foreground w-10 shrink-0">When</label>
        <NativeSelect
          value={condition.field}
          onChange={(e) => handleFieldChange(e.target.value)}
          size="sm"
          className="flex-1 text-xs"
        >
          {availableFields.length === 0 && <NativeSelectOption value="">No fields available</NativeSelectOption>}
          {availableFields.map((f) => (
            <NativeSelectOption key={f.id} value={f.id}>{f.label}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <label className="text-[10px] font-medium text-muted-foreground w-10 shrink-0">Is</label>
        <NativeSelect
          value={condition.operator}
          onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
          size="sm"
          className="flex-1 text-xs"
        >
          {operators.map((op) => (
            <NativeSelectOption key={op.value} value={op.value}>{op.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {needsValue && (
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-muted-foreground w-10 shrink-0">Value</label>
          <ValueInput
            dataType={selectedField?.dataType ?? "TEXT"}
            value={condition.value}
            onChange={(v) => onChange({ ...condition, value: v })}
          />
        </div>
      )}
    </div>
  );
}

function ValueInput({
  dataType,
  value,
  onChange,
}: {
  dataType: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const dt = dataType.toUpperCase();

  if (dt === "BOOLEAN" || dt === "TOGGLE") {
    return (
      <NativeSelect
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        size="sm"
        className="flex-1 text-xs"
      >
        <NativeSelectOption value="">Select...</NativeSelectOption>
        <NativeSelectOption value="true">True</NativeSelectOption>
        <NativeSelectOption value="false">False</NativeSelectOption>
      </NativeSelect>
    );
  }

  if (dt === "NUMBER" || dt === "DECIMAL" || dt === "INTEGER" || dt === "CURRENCY") {
    return (
      <Input
        type="number"
        value={value != null ? String(value) : ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="h-7 flex-1 text-xs"
        placeholder="Enter a number"
      />
    );
  }

  if (dt === "DATE" || dt === "DATETIME") {
    return (
      <Input
        type={dt === "DATE" ? "date" : "datetime-local"}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 flex-1 text-xs"
      />
    );
  }

  return (
    <Input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 flex-1 text-xs"
      placeholder="Enter a value"
    />
  );
}

function ConditionPreview({
  condition,
  availableFields,
}: {
  condition: VisibilityCondition;
  availableFields: FieldDefinitionLookup[];
}) {
  const text = conditionToText(condition, availableFields);

  return (
    <div className="rounded bg-muted/50 px-2.5 py-2 text-[11px]">
      <span className="font-medium text-muted-foreground">Show when: </span>
      <span>{text}</span>
    </div>
  );
}

function conditionToText(condition: VisibilityCondition, fields: FieldDefinitionLookup[]): string {
  if (condition.type === "simple") {
    const fd = fields.find((f) => f.id === condition.field);
    const fieldLabel = fd?.label ?? "Unknown field";
    const ops = getOperatorsForType(fd?.dataType ?? "TEXT");
    const opInfo = ops.find((o) => o.value === condition.operator);
    const opLabel = opInfo?.label ?? condition.operator;

    if (!opInfo?.needsValue) {
      return `${fieldLabel} ${opLabel}`;
    }

    const valueStr =
      condition.value != null && condition.value !== "" ? String(condition.value) : "?";
    return `${fieldLabel} ${opLabel} "${valueStr}"`;
  }

  const parts = condition.conditions.map((c) => conditionToText(c, fields));
  const joiner = condition.operator === "and" ? " AND " : " OR ";
  return parts.join(joiner);
}
