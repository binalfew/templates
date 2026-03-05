import { describe, it, expect } from "vitest";

function labelToValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

interface EnumOption {
  value: string;
  label: string;
}

function addOption(options: EnumOption[], label: string): EnumOption[] {
  const trimmed = label.trim();
  if (!trimmed) return options;
  const value = labelToValue(trimmed);
  if (options.some((o) => o.value === value)) return options;
  return [...options, { value, label: trimmed }];
}

function removeOption(options: EnumOption[], index: number): EnumOption[] {
  return options.filter((_, i) => i !== index);
}

function moveOption(options: EnumOption[], index: number, direction: "up" | "down"): EnumOption[] {
  const newOptions = [...options];
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= newOptions.length) return newOptions;
  [newOptions[index], newOptions[swapIndex]] = [newOptions[swapIndex], newOptions[index]];
  return newOptions;
}

describe("labelToValue", () => {
  it("converts label to snake_case value", () => {
    expect(labelToValue("Gluten Free")).toBe("gluten_free");
  });

  it("strips special characters", () => {
    expect(labelToValue("N/A (None)")).toBe("na_none");
  });

  it("handles single word", () => {
    expect(labelToValue("Vegan")).toBe("vegan");
  });
});

describe("addOption", () => {
  it("adds a new option", () => {
    const result = addOption([], "Vegetarian");
    expect(result).toEqual([{ value: "vegetarian", label: "Vegetarian" }]);
  });

  it("prevents duplicate values", () => {
    const initial = [{ value: "vegan", label: "Vegan" }];
    const result = addOption(initial, "Vegan");
    expect(result).toEqual(initial);
  });

  it("ignores empty labels", () => {
    const result = addOption([], "");
    expect(result).toEqual([]);
  });

  it("trims whitespace from labels", () => {
    const result = addOption([], "  Halal  ");
    expect(result).toEqual([{ value: "halal", label: "Halal" }]);
  });
});

describe("removeOption", () => {
  const options = [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "c", label: "C" },
  ];

  it("removes option at index", () => {
    const result = removeOption(options, 1);
    expect(result).toEqual([
      { value: "a", label: "A" },
      { value: "c", label: "C" },
    ]);
  });

  it("removes first option", () => {
    const result = removeOption(options, 0);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("b");
  });

  it("removes last option", () => {
    const result = removeOption(options, 2);
    expect(result).toHaveLength(2);
    expect(result[1].value).toBe("b");
  });
});

describe("moveOption", () => {
  const options = [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "c", label: "C" },
  ];

  it("moves option up", () => {
    const result = moveOption(options, 1, "up");
    expect(result.map((o) => o.value)).toEqual(["b", "a", "c"]);
  });

  it("moves option down", () => {
    const result = moveOption(options, 0, "down");
    expect(result.map((o) => o.value)).toEqual(["b", "a", "c"]);
  });

  it("does nothing when moving first item up", () => {
    const result = moveOption(options, 0, "up");
    expect(result.map((o) => o.value)).toEqual(["a", "b", "c"]);
  });

  it("does nothing when moving last item down", () => {
    const result = moveOption(options, 2, "down");
    expect(result.map((o) => o.value)).toEqual(["a", "b", "c"]);
  });
});
