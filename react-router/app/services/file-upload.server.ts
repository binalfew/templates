import * as fs from "node:fs/promises";
import * as path from "node:path";
import crypto from "node:crypto";
import { env } from "~/lib/config/env.server";
import { logger } from "~/lib/monitoring/logger.server";
import { ServiceError } from "~/lib/errors/service-error.server";
import { prisma } from "~/lib/db/db.server";

export interface UploadOptions {
  tenantId: string;
  uploadedBy: string;
  allowedTypes?: string[];
  ipAddress?: string;
  userAgent?: string;
}

export interface UploadResult {
  allowed: boolean;
  reason?: string;
  fileId?: string;
  url?: string;
}

export interface FileMeta {
  fileId: string;
  originalName: string;
  mimeType: string;
  tenantId: string;
  uploadedBy: string;
  size: number;
  createdAt: string;
  filePath: string;
}

export const DEFAULT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export class FileUploadError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "FileUploadError";
  }
}

// ─── Magic Bytes ─────────────────────────────────────────

/**
 * Magic bytes signatures for common file types.
 * Maps MIME type to an array of possible signatures (hex byte arrays).
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF....WEBP)
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0]], // OLE compound
  "application/vnd.ms-excel": [[0xd0, 0xcf, 0x11, 0xe0]],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    [0x50, 0x4b, 0x03, 0x04],
  ], // ZIP (OOXML)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [[0x50, 0x4b, 0x03, 0x04]],
};

/**
 * Validates file content against declared MIME type using magic bytes.
 * Returns true for types not in our map (permissive for unknown types).
 */
function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  const signatures = MAGIC_BYTES[claimedType];
  if (!signatures) {
    return true; // Unknown type — allow through
  }

  if (buffer.length === 0) {
    return false;
  }

  return signatures.some((sig) => {
    if (buffer.length < sig.length) return false;
    return sig.every((byte, i) => buffer[i] === byte);
  });
}

// ─── File Upload Pipeline ────────────────────────────────

/**
 * Full file upload pipeline:
 * 1. MIME type check
 * 2. Magic bytes validation
 * 3. Size check
 * 4. Store locally
 * 5. Save metadata to database (UploadedFile model)
 * 6. Write .meta.json sidecar
 * 7. Audit log
 */
export async function processFileUpload(file: File, options: UploadOptions): Promise<UploadResult> {
  const { tenantId, uploadedBy, ipAddress, userAgent } = options;
  const allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;
  const mimeType = file.type;
  const originalName = file.name;

  // 1. MIME type check
  if (!allowedTypes.includes(mimeType)) {
    await auditBlock(
      tenantId,
      uploadedBy,
      originalName,
      "File type not allowed",
      ipAddress,
      userAgent,
    );
    return { allowed: false, reason: "File type not allowed" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 2. Magic bytes check
  if (!validateMagicBytes(buffer, mimeType)) {
    await auditBlock(
      tenantId,
      uploadedBy,
      originalName,
      "File content does not match declared type",
      ipAddress,
      userAgent,
    );
    return { allowed: false, reason: "File content does not match declared type" };
  }

  // 3. Size check
  const maxBytes = (env as any).FILE_UPLOAD_MAX_SIZE_MB
    ? (env as any).FILE_UPLOAD_MAX_SIZE_MB * 1024 * 1024
    : 10 * 1024 * 1024; // Default 10MB
  if (buffer.length > maxBytes) {
    await auditBlock(
      tenantId,
      uploadedBy,
      originalName,
      "File exceeds size limit",
      ipAddress,
      userAgent,
    );
    return { allowed: false, reason: "File exceeds size limit" };
  }

  // 4. Store file locally
  const {
    fileId,
    path: filePath,
    url,
  } = await storeFileLocally(buffer, tenantId, originalName, mimeType);

  // 5. Save metadata to database
  try {
    await prisma.uploadedFile.create({
      data: {
        id: fileId,
        tenantId,
        uploadedBy,
        originalName,
        mimeType,
        sizeBytes: buffer.length,
        storagePath: filePath,
      },
    });
  } catch (err) {
    logger.warn({ err, fileId }, "Could not save file metadata to database (UploadedFile model may not exist)");
  }

  // 6. Write .meta.json sidecar
  const meta: FileMeta = {
    fileId,
    originalName,
    mimeType,
    tenantId,
    uploadedBy,
    size: buffer.length,
    createdAt: new Date().toISOString(),
    filePath,
  };
  const metaPath = filePath + ".meta.json";
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

  // 7. Audit log (success)
  prisma.auditLog
    .create({
      data: {
        tenantId,
        userId: uploadedBy,
        action: "FILE_UPLOAD",
        entityType: "File",
        entityId: fileId,
        description: `Uploaded file "${originalName}"`,
        ipAddress,
        userAgent,
        metadata: { originalName, mimeType, size: buffer.length, fileId },
      },
    })
    .catch((err: unknown) => logger.error({ err }, "Failed to create FILE_UPLOAD audit log"));

  return { allowed: true, fileId, url };
}

// ─── File Storage ────────────────────────────────────────

/**
 * Stores a file buffer to local disk.
 * Layout: {FILE_UPLOAD_DIR}/{tenantId}/{YYYY}/{MM}/{fileId}{ext}
 */
export async function storeFileLocally(
  buffer: Buffer,
  tenantId: string,
  originalName: string,
  mimeType: string,
): Promise<{ fileId: string; path: string; url: string }> {
  const fileId = crypto.randomUUID();
  const ext = path.extname(originalName) || mimeExtension(mimeType);
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  const uploadDir = (env as any).FILE_UPLOAD_DIR ?? "./uploads";
  const dir = path.join(uploadDir, tenantId, year, month);
  await fs.mkdir(dir, { recursive: true });

  const fileName = `${fileId}${ext}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);

  const url = `/api/v1/files/${fileId}`;

  return { fileId, path: filePath, url };
}

// ─── File Metadata ───────────────────────────────────────

/**
 * Retrieves file metadata by searching for the .meta.json sidecar file.
 */
export async function getFileMetadata(fileId: string): Promise<FileMeta | null> {
  const uploadDir = (env as any).FILE_UPLOAD_DIR ?? "./uploads";
  const metaFile = await findMetaFile(uploadDir, fileId);
  if (!metaFile) return null;

  const content = await fs.readFile(metaFile, "utf8");
  return JSON.parse(content) as FileMeta;
}

/**
 * Recursively searches for a .meta.json file matching the given fileId.
 */
async function findMetaFile(baseDir: string, fileId: string): Promise<string | null> {
  try {
    await fs.access(baseDir);
  } catch {
    return null;
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      const result = await findMetaFile(fullPath, fileId);
      if (result) return result;
    } else if (
      entry.name === `${fileId}.meta.json` ||
      (entry.name.startsWith(fileId) && entry.name.endsWith(".meta.json"))
    ) {
      return fullPath;
    }
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────

function mimeExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };
  return map[mimeType] ?? "";
}

async function auditBlock(
  tenantId: string,
  userId: string,
  originalName: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string,
) {
  prisma.auditLog
    .create({
      data: {
        tenantId,
        userId,
        action: "FILE_UPLOAD_BLOCKED",
        entityType: "File",
        entityId: originalName,
        description: `File upload blocked: ${reason}`,
        ipAddress,
        userAgent,
        metadata: { originalName, reason },
      },
    })
    .catch((err: unknown) =>
      logger.error({ err }, "Failed to create FILE_UPLOAD_BLOCKED audit log"),
    );
}
