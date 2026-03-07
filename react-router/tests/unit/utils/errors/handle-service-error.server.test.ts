import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router", () => ({
  data: vi.fn((body: unknown, init?: { status?: number }) => ({
    body,
    status: init?.status,
  })),
}));

describe("handle-service-error.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("handleServiceError without submission (simple error)", () => {
    it("should return error message and status for a ServiceError", async () => {
      const { ServiceError } = await import("~/utils/errors/service-error.server");
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const error = new ServiceError("User not found", 404);
      const result = handleServiceError(error);

      expect(result).toEqual({
        body: { error: "User not found" },
        status: 404,
      });
    });

    it("should use default status 400 for ServiceError without custom status", async () => {
      const { ServiceError } = await import("~/utils/errors/service-error.server");
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const error = new ServiceError("Validation failed");
      const result = handleServiceError(error);

      expect(result).toEqual({
        body: { error: "Validation failed" },
        status: 400,
      });
    });

    it("should handle 500 status ServiceError", async () => {
      const { ServiceError } = await import("~/utils/errors/service-error.server");
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const error = new ServiceError("Internal failure", 500, "INTERNAL");
      const result = handleServiceError(error);

      expect(result).toEqual({
        body: { error: "Internal failure" },
        status: 500,
      });
    });

    it("should re-throw non-ServiceError errors", async () => {
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const plainError = new Error("Unexpected error");
      expect(() => handleServiceError(plainError)).toThrow("Unexpected error");
    });

    it("should re-throw string errors", async () => {
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      expect(() => handleServiceError("some string")).toThrow("some string");
    });

    it("should re-throw null/undefined errors", async () => {
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      expect(() => handleServiceError(null)).toThrow();
      expect(() => handleServiceError(undefined)).toThrow();
    });
  });

  describe("handleServiceError with submission (Conform form errors)", () => {
    it("should call submission.reply with formErrors and return result", async () => {
      const { ServiceError } = await import("~/utils/errors/service-error.server");
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const mockReply = vi.fn().mockReturnValue({ status: "error", error: {} });
      const submission = { reply: mockReply };

      const error = new ServiceError("Email already taken", 409);
      const result = handleServiceError(error, { submission });

      expect(mockReply).toHaveBeenCalledWith({
        formErrors: ["Email already taken"],
      });
      expect(result).toEqual({
        body: { result: { status: "error", error: {} } },
        status: 409,
      });
    });

    it("should use default status 400 with submission", async () => {
      const { ServiceError } = await import("~/utils/errors/service-error.server");
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const mockReply = vi.fn().mockReturnValue({ status: "error", error: {} });
      const submission = { reply: mockReply };

      const error = new ServiceError("Invalid input");
      const result = handleServiceError(error, { submission });

      expect(mockReply).toHaveBeenCalledWith({
        formErrors: ["Invalid input"],
      });
      expect(result).toEqual({
        body: { result: { status: "error", error: {} } },
        status: 400,
      });
    });

    it("should re-throw non-ServiceError errors even with submission", async () => {
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const mockReply = vi.fn();
      const submission = { reply: mockReply };

      const plainError = new TypeError("Cannot read property");
      expect(() => handleServiceError(plainError, { submission })).toThrow(
        "Cannot read property",
      );
      expect(mockReply).not.toHaveBeenCalled();
    });

    it("should handle 403 forbidden with submission", async () => {
      const { ServiceError } = await import("~/utils/errors/service-error.server");
      const { handleServiceError } = await import("~/utils/errors/handle-service-error.server");

      const mockReply = vi.fn().mockReturnValue({ status: "error", error: {} });
      const submission = { reply: mockReply };

      const error = new ServiceError("Not authorized", 403);
      const result = handleServiceError(error, { submission });

      expect(result).toEqual({
        body: { result: { status: "error", error: {} } },
        status: 403,
      });
    });
  });
});
