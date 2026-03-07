import { data } from "react-router";
import { prisma } from "~/utils/db/db.server";

export async function loader() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response("OK", {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    throw data("Database connection failed", { status: 503 });
  }
}
