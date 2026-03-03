import crypto from "node:crypto";

export function generateETag(body: string): string {
  return `"${crypto.createHash("sha256").update(body).digest("hex").slice(0, 16)}"`;
}

export function handleConditionalRequest(
  request: Request,
  body: string,
  headers: Record<string, string> = {},
): Response {
  const etag = generateETag(body);
  const ifNoneMatch = request.headers.get("If-None-Match");

  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache",
      ETag: etag,
      ...headers,
    },
  });
}

export const CACHE_HEADERS = {
  static: {
    "Cache-Control": "public, max-age=31536000, immutable",
  },
  noStore: {
    "Cache-Control": "no-store",
  },
  privateNoCache: {
    "Cache-Control": "private, no-cache",
  },
} as const;
