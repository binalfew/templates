import { describe, it, expect } from "vitest";
import { evaluateCondition, getOperatorsForType } from "../condition-evaluator";
import type { VisibilityCondition } from "~/types/form-designer";

describe("evaluateCondition", () => {
  it("returns true when condition is undefined", () => {
    expect(evaluateCondition(undefined, {})).toBe(true);
  });

  it("eq: matches string values", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "name",
      operator: "eq",
      value: "Alice",
    };
    expect(evaluateCondition(c, { name: "Alice" })).toBe(true);
    expect(evaluateCondition(c, { name: "Bob" })).toBe(false);
  });

  it("eq: case-insensitive comparison", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "name",
      operator: "eq",
      value: "alice",
    };
    expect(evaluateCondition(c, { name: "Alice" })).toBe(true);
  });

  it("eq: coerces number and string", () => {
    const c: VisibilityCondition = { type: "simple", field: "age", operator: "eq", value: 25 };
    expect(evaluateCondition(c, { age: "25" })).toBe(true);
  });

  it("eq: null matches null/undefined", () => {
    const c: VisibilityCondition = { type: "simple", field: "x", operator: "eq", value: null };
    expect(evaluateCondition(c, { x: null })).toBe(true);
    expect(evaluateCondition(c, { x: undefined })).toBe(true);
    expect(evaluateCondition(c, {})).toBe(true);
  });

  it("neq: returns inverse of eq", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "color",
      operator: "neq",
      value: "red",
    };
    expect(evaluateCondition(c, { color: "blue" })).toBe(true);
    expect(evaluateCondition(c, { color: "red" })).toBe(false);
  });

  it("empty: true for null, undefined, empty string", () => {
    const c: VisibilityCondition = { type: "simple", field: "x", operator: "empty", value: null };
    expect(evaluateCondition(c, { x: null })).toBe(true);
    expect(evaluateCondition(c, { x: undefined })).toBe(true);
    expect(evaluateCondition(c, {})).toBe(true);
    expect(evaluateCondition(c, { x: "" })).toBe(true);
    expect(evaluateCondition(c, { x: "  " })).toBe(true);
  });

  it("empty: true for empty array", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "tags",
      operator: "empty",
      value: null,
    };
    expect(evaluateCondition(c, { tags: [] })).toBe(true);
    expect(evaluateCondition(c, { tags: ["a"] })).toBe(false);
  });

  it("empty: false for non-empty values", () => {
    const c: VisibilityCondition = { type: "simple", field: "x", operator: "empty", value: null };
    expect(evaluateCondition(c, { x: "hello" })).toBe(false);
    expect(evaluateCondition(c, { x: 0 })).toBe(false);
    expect(evaluateCondition(c, { x: false })).toBe(false);
  });

  it("notEmpty: inverse of empty", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "x",
      operator: "notEmpty",
      value: null,
    };
    expect(evaluateCondition(c, { x: "hello" })).toBe(true);
    expect(evaluateCondition(c, { x: "" })).toBe(false);
    expect(evaluateCondition(c, {})).toBe(false);
  });

  it("gt: numeric comparison", () => {
    const c: VisibilityCondition = { type: "simple", field: "age", operator: "gt", value: 18 };
    expect(evaluateCondition(c, { age: 21 })).toBe(true);
    expect(evaluateCondition(c, { age: 18 })).toBe(false);
    expect(evaluateCondition(c, { age: 10 })).toBe(false);
  });

  it("lt: numeric comparison", () => {
    const c: VisibilityCondition = { type: "simple", field: "age", operator: "lt", value: 18 };
    expect(evaluateCondition(c, { age: 10 })).toBe(true);
    expect(evaluateCondition(c, { age: 18 })).toBe(false);
  });

  it("gte: numeric comparison", () => {
    const c: VisibilityCondition = { type: "simple", field: "age", operator: "gte", value: 18 };
    expect(evaluateCondition(c, { age: 18 })).toBe(true);
    expect(evaluateCondition(c, { age: 17 })).toBe(false);
  });

  it("lte: numeric comparison", () => {
    const c: VisibilityCondition = { type: "simple", field: "age", operator: "lte", value: 18 };
    expect(evaluateCondition(c, { age: 18 })).toBe(true);
    expect(evaluateCondition(c, { age: 19 })).toBe(false);
  });

  it("gt: coerces string to number", () => {
    const c: VisibilityCondition = { type: "simple", field: "score", operator: "gt", value: "50" };
    expect(evaluateCondition(c, { score: 60 })).toBe(true);
    expect(evaluateCondition(c, { score: "70" })).toBe(true);
  });

  it("numeric operators treat non-numeric as 0", () => {
    const c: VisibilityCondition = { type: "simple", field: "x", operator: "gt", value: 0 };
    expect(evaluateCondition(c, { x: "abc" })).toBe(false);
    expect(evaluateCondition(c, {})).toBe(false);
  });

  it("contains: case-insensitive substring match", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "title",
      operator: "contains",
      value: "hello",
    };
    expect(evaluateCondition(c, { title: "Hello World" })).toBe(true);
    expect(evaluateCondition(c, { title: "Goodbye" })).toBe(false);
  });

  it("contains: handles null gracefully", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "title",
      operator: "contains",
      value: "x",
    };
    expect(evaluateCondition(c, {})).toBe(false);
  });

  it("in: checks if value is in array", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "status",
      operator: "in",
      value: ["active", "pending"],
    };
    expect(evaluateCondition(c, { status: "active" })).toBe(true);
    expect(evaluateCondition(c, { status: "pending" })).toBe(true);
    expect(evaluateCondition(c, { status: "rejected" })).toBe(false);
  });

  it("in: returns false when value is not an array", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "x",
      operator: "in",
      value: "not-array",
    };
    expect(evaluateCondition(c, { x: "not-array" })).toBe(false);
  });

  it("notIn: checks if value is NOT in array", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "status",
      operator: "notIn",
      value: ["rejected", "blocked"],
    };
    expect(evaluateCondition(c, { status: "active" })).toBe(true);
    expect(evaluateCondition(c, { status: "rejected" })).toBe(false);
  });

  it("notIn: returns true when value is not an array", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "x",
      operator: "notIn",
      value: "not-array",
    };
    expect(evaluateCondition(c, { x: "anything" })).toBe(true);
  });

  it("compound AND: all must be true", () => {
    const c: VisibilityCondition = {
      type: "compound",
      operator: "and",
      conditions: [
        { type: "simple", field: "age", operator: "gte", value: 18 },
        { type: "simple", field: "country", operator: "eq", value: "US" },
      ],
    };
    expect(evaluateCondition(c, { age: 21, country: "US" })).toBe(true);
    expect(evaluateCondition(c, { age: 21, country: "UK" })).toBe(false);
    expect(evaluateCondition(c, { age: 16, country: "US" })).toBe(false);
  });

  it("compound OR: at least one must be true", () => {
    const c: VisibilityCondition = {
      type: "compound",
      operator: "or",
      conditions: [
        { type: "simple", field: "role", operator: "eq", value: "admin" },
        { type: "simple", field: "role", operator: "eq", value: "editor" },
      ],
    };
    expect(evaluateCondition(c, { role: "admin" })).toBe(true);
    expect(evaluateCondition(c, { role: "editor" })).toBe(true);
    expect(evaluateCondition(c, { role: "viewer" })).toBe(false);
  });

  it("compound with empty conditions returns true", () => {
    const c: VisibilityCondition = { type: "compound", operator: "and", conditions: [] };
    expect(evaluateCondition(c, {})).toBe(true);
  });

  it("nested compound conditions", () => {
    const c: VisibilityCondition = {
      type: "compound",
      operator: "and",
      conditions: [
        { type: "simple", field: "active", operator: "eq", value: "true" },
        {
          type: "compound",
          operator: "or",
          conditions: [
            { type: "simple", field: "role", operator: "eq", value: "admin" },
            { type: "simple", field: "role", operator: "eq", value: "editor" },
          ],
        },
      ],
    };
    expect(evaluateCondition(c, { active: "true", role: "admin" })).toBe(true);
    expect(evaluateCondition(c, { active: "true", role: "viewer" })).toBe(false);
    expect(evaluateCondition(c, { active: "false", role: "admin" })).toBe(false);
  });

  it("unknown operator defaults to true", () => {
    const c: VisibilityCondition = {
      type: "simple",
      field: "x",
      operator: "unknownOp" as any,
      value: "y",
    };
    expect(evaluateCondition(c, { x: "z" })).toBe(true);
  });
});

describe("getOperatorsForType", () => {
  it("returns universal operators for all types", () => {
    const textOps = getOperatorsForType("TEXT");
    const values = textOps.map((o) => o.value);
    expect(values).toContain("eq");
    expect(values).toContain("neq");
    expect(values).toContain("empty");
    expect(values).toContain("notEmpty");
  });

  it("returns numeric operators for NUMBER type", () => {
    const ops = getOperatorsForType("NUMBER");
    const values = ops.map((o) => o.value);
    expect(values).toContain("gt");
    expect(values).toContain("lt");
    expect(values).toContain("gte");
    expect(values).toContain("lte");
    expect(values).not.toContain("contains");
  });

  it("returns contains for TEXT type", () => {
    const ops = getOperatorsForType("TEXT");
    const values = ops.map((o) => o.value);
    expect(values).toContain("contains");
  });

  it("returns only eq/neq/empty/notEmpty for BOOLEAN type", () => {
    const ops = getOperatorsForType("BOOLEAN");
    const values = ops.map((o) => o.value);
    expect(values).toEqual(["eq", "neq", "empty", "notEmpty"]);
  });

  it("returns list operators for SELECT type", () => {
    const ops = getOperatorsForType("SELECT");
    const values = ops.map((o) => o.value);
    expect(values).toContain("in");
    expect(values).toContain("notIn");
    expect(values).not.toContain("gt");
  });

  it("handles unknown types like TEXT", () => {
    const ops = getOperatorsForType("WHATEVER");
    const values = ops.map((o) => o.value);
    expect(values).toContain("eq");
    expect(values).toContain("contains");
    expect(values).toContain("in");
  });
});
