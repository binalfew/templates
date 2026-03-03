import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";

const mockAuditCreate = vi.fn();

vi.mock("~/lib/db.server", () => ({
  prisma: {
    auditLog: {
      create: mockAuditCreate,
    },
  },
}));

vi.mock("~/lib/logger.server", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/lib/env.server", () => ({
  env: {
    FILE_UPLOAD_MAX_SIZE_MB: 10,
    FILE_UPLOAD_DIR: "/tmp/test-uploads",
  },
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
    access: vi.fn().mockResolvedValue(undefined),
  };
});

// Magic byte prefixes so validateMagicBytes recognises the content
const MAGIC: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

function createMockFile(name: string, type: string, content: string): File {
  const prefix = MAGIC[type];
  if (prefix) {
    const magic = new Uint8Array(prefix);
    const body = new TextEncoder().encode(content);
    const combined = new Uint8Array(magic.length + body.length);
    combined.set(magic);
    combined.set(body, magic.length);
    return new File([combined], name, { type });
  }
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

const defaultOptions = {
  tenantId: "tenant-1",
  uploadedBy: "user-1",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

describe("file-upload.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditCreate.mockResolvedValue({});
  });

  describe("processFileUpload", () => {
    it("clean file passes pipeline and returns fileId/url", async () => {
      const { processFileUpload } = await import("../file-upload.server");
      const file = createMockFile("photo.jpg", "image/jpeg", "fake-jpeg-content");

      const result = await processFileUpload(file, defaultOptions);

      expect(result.allowed).toBe(true);
      expect(result.fileId).toBeDefined();
      expect(result.url).toMatch(/^\/api\/v1\/files\//);
    });

    it("rejects disallowed MIME type", async () => {
      const { processFileUpload } = await import("../file-upload.server");
      const file = createMockFile("script.exe", "application/x-executable", "MZ...");

      const result = await processFileUpload(file, defaultOptions);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("File type not allowed");
    });

    it("creates FILE_UPLOAD audit log on successful upload", async () => {
      const { processFileUpload } = await import("../file-upload.server");
      const file = createMockFile("doc.pdf", "application/pdf", "pdf content");

      await processFileUpload(file, defaultOptions);

      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "FILE_UPLOAD",
          tenantId: "tenant-1",
          userId: "user-1",
          entityType: "File",
          description: expect.stringContaining("doc.pdf"),
        }),
      });
    });

    it("stores files in correct tenant/year/month directory", async () => {
      const { processFileUpload } = await import("../file-upload.server");
      const file = createMockFile("report.pdf", "application/pdf", "pdf content");

      await processFileUpload(file, defaultOptions);

      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(`tenant-1/${year}/${month}`),
        { recursive: true },
      );
    });

    it("writes .meta.json sidecar file", async () => {
      const { processFileUpload } = await import("../file-upload.server");
      const file = createMockFile("photo.png", "image/png", "png content");

      await processFileUpload(file, defaultOptions);

      const writeFileCalls = (fs.writeFile as ReturnType<typeof vi.fn>).mock.calls;
      const metaCall = writeFileCalls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" && (call[0] as string).endsWith(".meta.json"),
      );
      expect(metaCall).toBeDefined();

      const metaContent = JSON.parse(metaCall![1] as string);
      expect(metaContent.originalName).toBe("photo.png");
      expect(metaContent.mimeType).toBe("image/png");
      expect(metaContent.tenantId).toBe("tenant-1");
      expect(metaContent.uploadedBy).toBe("user-1");
    });
  });
});
