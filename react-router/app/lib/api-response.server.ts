export function jsonSuccess(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(code: string, message: string, status = 400, details?: unknown) {
  return new Response(
    JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export function jsonPaginated(
  data: unknown[],
  total: number,
  page: number,
  pageSize: number,
) {
  return new Response(
    JSON.stringify({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
