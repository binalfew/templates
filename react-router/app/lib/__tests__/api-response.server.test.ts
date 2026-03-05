import { describe, it, expect } from "vitest";
import { jsonSuccess, jsonError, jsonPaginated, parsePagination } from "../api-response.server";

describe("api-response.server", () => {
  describe("jsonSuccess", () => {
    it("returns a 200 response with data wrapped in { data } envelope", async () => {
      const response = jsonSuccess({ id: "1", name: "Test" });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ data: { id: "1", name: "Test" } });
    });

    it("sets Content-Type to application/json", () => {
      const response = jsonSuccess({ id: "1" });

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("accepts a custom status code", async () => {
      const response = jsonSuccess({ id: "1" }, 201);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toEqual({ data: { id: "1" } });
    });

    it("wraps an array in data envelope", async () => {
      const items = [
        { id: "1", name: "A" },
        { id: "2", name: "B" },
      ];
      const response = jsonSuccess(items);

      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].id).toBe("1");
    });

    it("wraps null in data envelope", async () => {
      const response = jsonSuccess(null);

      const body = await response.json();
      expect(body).toEqual({ data: null });
    });

    it("wraps a string in data envelope", async () => {
      const response = jsonSuccess("hello");

      const body = await response.json();
      expect(body).toEqual({ data: "hello" });
    });

    it("wraps a number in data envelope", async () => {
      const response = jsonSuccess(42);

      const body = await response.json();
      expect(body).toEqual({ data: 42 });
    });

    it("defaults to status 200 when not specified", () => {
      const response = jsonSuccess({});

      expect(response.status).toBe(200);
    });
  });

  describe("jsonError", () => {
    it("returns error response with code and message", async () => {
      const response = jsonError("NOT_FOUND", "Resource not found", 404);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toEqual({
        error: { code: "NOT_FOUND", message: "Resource not found" },
      });
    });

    it("sets Content-Type to application/json", () => {
      const response = jsonError("BAD_REQUEST", "Invalid input");

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("defaults to status 400", () => {
      const response = jsonError("VALIDATION_ERROR", "Invalid email");

      expect(response.status).toBe(400);
    });

    it("includes details when provided", async () => {
      const details = {
        fields: {
          email: "Must be a valid email",
          name: "Required",
        },
      };
      const response = jsonError("VALIDATION_ERROR", "Validation failed", 422, details);

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: {
            fields: {
              email: "Must be a valid email",
              name: "Required",
            },
          },
        },
      });
    });

    it("omits details when not provided", async () => {
      const response = jsonError("SERVER_ERROR", "Internal error", 500);

      const body = await response.json();
      expect(body.error).not.toHaveProperty("details");
      expect(body).toEqual({
        error: { code: "SERVER_ERROR", message: "Internal error" },
      });
    });

    it("omits details when undefined is passed", async () => {
      const response = jsonError("BAD_REQUEST", "Bad request", 400, undefined);

      const body = await response.json();
      expect(body.error).not.toHaveProperty("details");
    });

    it("handles various status codes correctly", () => {
      expect(jsonError("UNAUTHORIZED", "Not authenticated", 401).status).toBe(401);
      expect(jsonError("FORBIDDEN", "Access denied", 403).status).toBe(403);
      expect(jsonError("CONFLICT", "Already exists", 409).status).toBe(409);
      expect(jsonError("RATE_LIMITED", "Too many requests", 429).status).toBe(429);
    });
  });

  describe("jsonPaginated", () => {
    it("returns paginated response with data and pagination metadata", async () => {
      const data = [
        { id: "1", name: "A" },
        { id: "2", name: "B" },
      ];
      const response = jsonPaginated(data, 50, 1, 20);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({
        data: [
          { id: "1", name: "A" },
          { id: "2", name: "B" },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 50,
          totalPages: 3,
        },
      });
    });

    it("sets Content-Type to application/json", () => {
      const response = jsonPaginated([], 0, 1, 20);

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("calculates totalPages correctly with exact division", async () => {
      const response = jsonPaginated([], 100, 1, 10);

      const body = await response.json();
      expect(body.pagination.totalPages).toBe(10);
    });

    it("rounds totalPages up for partial last page", async () => {
      const response = jsonPaginated([], 51, 1, 20);

      const body = await response.json();
      expect(body.pagination.totalPages).toBe(3);
    });

    it("returns totalPages of 0 when total is 0", async () => {
      const response = jsonPaginated([], 0, 1, 20);

      const body = await response.json();
      expect(body.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it("returns totalPages of 1 when total equals pageSize", async () => {
      const response = jsonPaginated([], 20, 1, 20);

      const body = await response.json();
      expect(body.pagination.totalPages).toBe(1);
    });

    it("returns totalPages of 1 when total is less than pageSize", async () => {
      const response = jsonPaginated([], 5, 1, 20);

      const body = await response.json();
      expect(body.pagination.totalPages).toBe(1);
    });

    it("preserves the page number in the response", async () => {
      const response = jsonPaginated([], 100, 5, 10);

      const body = await response.json();
      expect(body.pagination.page).toBe(5);
    });

    it("handles single-item data array", async () => {
      const response = jsonPaginated([{ id: "1" }], 1, 1, 20);

      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
      expect(body.pagination.totalPages).toBe(1);
    });
  });

  describe("parsePagination", () => {
    it("parses page and pageSize from URL search params", () => {
      const url = new URL("http://localhost/api/v1/events?page=3&pageSize=25");
      const result = parsePagination(url);

      expect(result).toEqual({ page: 3, pageSize: 25, skip: 50 });
    });

    it("defaults page to 1 when not specified", () => {
      const url = new URL("http://localhost/api/v1/events?pageSize=10");
      const result = parsePagination(url);

      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it("defaults pageSize to 20 when not specified", () => {
      const url = new URL("http://localhost/api/v1/events?page=2");
      const result = parsePagination(url);

      expect(result.pageSize).toBe(20);
      expect(result.skip).toBe(20);
    });

    it("defaults both to page=1 and pageSize=20 when no params", () => {
      const url = new URL("http://localhost/api/v1/events");
      const result = parsePagination(url);

      expect(result).toEqual({ page: 1, pageSize: 20, skip: 0 });
    });

    it("calculates skip correctly for first page", () => {
      const url = new URL("http://localhost/api/v1/events?page=1&pageSize=10");
      const result = parsePagination(url);

      expect(result.skip).toBe(0);
    });

    it("calculates skip correctly for subsequent pages", () => {
      const url = new URL("http://localhost/api/v1/events?page=4&pageSize=15");
      const result = parsePagination(url);

      expect(result.skip).toBe(45);
    });

    it("clamps page to minimum of 1", () => {
      const url = new URL("http://localhost/api/v1/events?page=0");
      const result = parsePagination(url);

      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it("clamps negative page to 1", () => {
      const url = new URL("http://localhost/api/v1/events?page=-5");
      const result = parsePagination(url);

      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it("clamps pageSize to minimum of 1", () => {
      const url = new URL("http://localhost/api/v1/events?pageSize=0");
      const result = parsePagination(url);

      expect(result.pageSize).toBe(1);
    });

    it("clamps negative pageSize to 1", () => {
      const url = new URL("http://localhost/api/v1/events?pageSize=-10");
      const result = parsePagination(url);

      expect(result.pageSize).toBe(1);
    });

    it("caps pageSize at 100", () => {
      const url = new URL("http://localhost/api/v1/events?pageSize=500");
      const result = parsePagination(url);

      expect(result.pageSize).toBe(100);
    });

    it("allows pageSize of exactly 100", () => {
      const url = new URL("http://localhost/api/v1/events?pageSize=100");
      const result = parsePagination(url);

      expect(result.pageSize).toBe(100);
    });

    it("returns NaN for non-numeric page param", () => {
      const url = new URL("http://localhost/api/v1/events?page=abc");
      const result = parsePagination(url);

      // parseInt("abc") returns NaN, Math.max(1, NaN) returns NaN
      expect(result.page).toBeNaN();
    });

    it("returns NaN for non-numeric pageSize param", () => {
      const url = new URL("http://localhost/api/v1/events?pageSize=abc");
      const result = parsePagination(url);

      // parseInt("abc") returns NaN, Math.max/Math.min with NaN returns NaN
      expect(result.pageSize).toBeNaN();
    });
  });
});
