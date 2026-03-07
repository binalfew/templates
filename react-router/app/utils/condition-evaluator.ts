import type { VisibilityCondition, ConditionOperator } from "~/types/form-designer";

/**
 * Evaluate a visibility condition against a set of form values.
 * Pure function — usable on both client and server.
 */
export function evaluateCondition(
  condition: VisibilityCondition | undefined,
  formValues: Record<string, unknown>,
): boolean {
  if (!condition) return true;

  if (condition.type === "simple") {
    return evaluateSimple(condition.field, condition.operator, condition.value, formValues);
  }

  if (condition.type === "compound") {
    if (condition.conditions.length === 0) return true;

    if (condition.operator === "and") {
      return condition.conditions.every((c) => evaluateCondition(c, formValues));
    }
    return condition.conditions.some((c) => evaluateCondition(c, formValues));
  }

  return true;
}

function evaluateSimple(
  field: string,
  operator: ConditionOperator,
  expected: unknown,
  formValues: Record<string, unknown>,
): boolean {
  const actual = formValues[field];

  switch (operator) {
    case "eq":
      return looseEqual(actual, expected);
    case "neq":
      return !looseEqual(actual, expected);
    case "empty":
      return isEmpty(actual);
    case "notEmpty":
      return !isEmpty(actual);
    case "gt":
      return toNumber(actual) > toNumber(expected);
    case "lt":
      return toNumber(actual) < toNumber(expected);
    case "gte":
      return toNumber(actual) >= toNumber(expected);
    case "lte":
      return toNumber(actual) <= toNumber(expected);
    case "contains":
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase());
    case "in":
      return Array.isArray(expected) ? expected.some((v) => looseEqual(actual, v)) : false;
    case "notIn":
      return Array.isArray(expected) ? !expected.some((v) => looseEqual(actual, v)) : true;
    default:
      return true;
  }
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

// ─── Operator metadata ──────────────────────────────────

export interface OperatorInfo {
  value: ConditionOperator;
  label: string;
  needsValue: boolean;
}

const allOperators: OperatorInfo[] = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "does not equal", needsValue: true },
  { value: "empty", label: "is empty", needsValue: false },
  { value: "notEmpty", label: "is not empty", needsValue: false },
  { value: "gt", label: "greater than", needsValue: true },
  { value: "lt", label: "less than", needsValue: true },
  { value: "gte", label: "greater or equal", needsValue: true },
  { value: "lte", label: "less or equal", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "in", label: "is one of", needsValue: true },
  { value: "notIn", label: "is not one of", needsValue: true },
];

export function getOperatorsForType(dataType: string): OperatorInfo[] {
  const universal: ConditionOperator[] = ["eq", "neq", "empty", "notEmpty"];
  const numeric: ConditionOperator[] = ["gt", "lt", "gte", "lte"];
  const text: ConditionOperator[] = ["contains"];
  const list: ConditionOperator[] = ["in", "notIn"];

  const dt = dataType.toUpperCase();

  let allowed: ConditionOperator[];
  switch (dt) {
    case "NUMBER":
    case "DECIMAL":
    case "INTEGER":
    case "CURRENCY":
    case "DATE":
    case "DATETIME":
      allowed = [...universal, ...numeric];
      break;
    case "BOOLEAN":
    case "TOGGLE":
      allowed = ["eq", "neq", "empty", "notEmpty"];
      break;
    case "SELECT":
    case "RADIO":
    case "DROPDOWN":
      allowed = [...universal, ...list];
      break;
    case "MULTI_SELECT":
    case "CHECKBOX_GROUP":
      allowed = [...universal, "contains", ...list];
      break;
    default:
      allowed = [...universal, ...text, ...list];
      break;
  }

  return allOperators.filter((op) => allowed.includes(op.value));
}
