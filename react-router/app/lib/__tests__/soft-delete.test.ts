import { describe, it, expect } from "vitest";
import { isDeleted } from "../soft-delete.server";

describe("isDeleted", () => {
  it("returns true when deletedAt is set", () => {
    expect(isDeleted({ deletedAt: new Date() })).toBe(true);
  });

  it("returns true when deletedAt is a past date", () => {
    expect(isDeleted({ deletedAt: new Date("2024-01-01") })).toBe(true);
  });

  it("returns false when deletedAt is null", () => {
    expect(isDeleted({ deletedAt: null })).toBe(false);
  });
});
