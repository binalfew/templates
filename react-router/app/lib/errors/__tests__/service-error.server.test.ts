import { describe, it, expect } from "vitest";

import { ServiceError } from "../service-error.server";

describe("ServiceError", () => {
  it("should create an error with default status 400", () => {
    const error = new ServiceError("Something went wrong");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.message).toBe("Something went wrong");
    expect(error.status).toBe(400);
    expect(error.code).toBeUndefined();
    expect(error.name).toBe("ServiceError");
  });

  it("should accept a custom status code", () => {
    const error = new ServiceError("Not found", 404);
    expect(error.message).toBe("Not found");
    expect(error.status).toBe(404);
    expect(error.code).toBeUndefined();
  });

  it("should accept a custom status and error code", () => {
    const error = new ServiceError("Conflict detected", 409, "DUPLICATE_ENTRY");
    expect(error.message).toBe("Conflict detected");
    expect(error.status).toBe(409);
    expect(error.code).toBe("DUPLICATE_ENTRY");
  });

  it("should extend Error and have a stack trace", () => {
    const error = new ServiceError("Test error");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ServiceError");
  });

  it("should set name to 'ServiceError'", () => {
    const error = new ServiceError("Named error", 500, "INTERNAL");
    expect(error.name).toBe("ServiceError");
  });

  it("should work with instanceof checks", () => {
    const error = new ServiceError("Check");
    expect(error instanceof ServiceError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  it("should handle status 0", () => {
    const error = new ServiceError("Zero status", 0);
    expect(error.status).toBe(0);
  });

  it("should handle empty message", () => {
    const error = new ServiceError("");
    expect(error.message).toBe("");
    expect(error.status).toBe(400);
  });

  it("should handle 5xx status codes", () => {
    const error = new ServiceError("Server error", 500, "INTERNAL_ERROR");
    expect(error.status).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("should handle 401 unauthorized", () => {
    const error = new ServiceError("Unauthorized", 401);
    expect(error.status).toBe(401);
    expect(error.message).toBe("Unauthorized");
  });

  it("should handle 403 forbidden", () => {
    const error = new ServiceError("Forbidden", 403, "ACCESS_DENIED");
    expect(error.status).toBe(403);
    expect(error.code).toBe("ACCESS_DENIED");
  });
});
