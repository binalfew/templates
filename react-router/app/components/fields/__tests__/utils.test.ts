import { describe, it, expect } from "vitest";
import { labelToFieldName, formatDataType } from "../+utils";

describe("labelToFieldName", () => {
  it("converts a simple label to snake_case", () => {
    expect(labelToFieldName("Passport Number")).toBe("passport_number");
  });

  it("handles single word", () => {
    expect(labelToFieldName("Email")).toBe("email");
  });

  it("strips special characters", () => {
    expect(labelToFieldName("Date of Birth (DOB)")).toBe("date_of_birth_dob");
  });

  it("strips leading non-alpha characters", () => {
    expect(labelToFieldName("123 Test")).toBe("test");
  });

  it("trims whitespace", () => {
    expect(labelToFieldName("  VIP Access  ")).toBe("vip_access");
  });

  it("collapses multiple spaces to single underscore", () => {
    expect(labelToFieldName("Contact   Email")).toBe("contact_email");
  });

  it("handles empty string", () => {
    expect(labelToFieldName("")).toBe("");
  });

  it("truncates to 64 characters", () => {
    const longLabel = "A ".repeat(50);
    const result = labelToFieldName(longLabel);
    expect(result.length).toBeLessThanOrEqual(64);
  });

  it("strips trailing underscores from trimming", () => {
    expect(labelToFieldName("Test !!!")).toBe("test");
  });
});

describe("formatDataType", () => {
  it("formats single word types", () => {
    expect(formatDataType("TEXT")).toBe("Text");
    expect(formatDataType("NUMBER")).toBe("Number");
    expect(formatDataType("BOOLEAN")).toBe("Boolean");
  });

  it("formats multi-word types", () => {
    expect(formatDataType("MULTI_ENUM")).toBe("Multi Enum");
    expect(formatDataType("LONG_TEXT")).toBe("Long Text");
  });

  it("handles already formatted input", () => {
    expect(formatDataType("DATE")).toBe("Date");
  });
});
