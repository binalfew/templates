import type { ServiceContext, TenantServiceContext } from "~/utils/types.server";

interface UserLike {
  id: string;
  tenantId?: string | null;
}

export function buildServiceContext(request: Request, user: UserLike): ServiceContext;
export function buildServiceContext(
  request: Request,
  user: UserLike,
  tenantId: string,
): TenantServiceContext;
export function buildServiceContext(
  request: Request,
  user: UserLike,
  tenantId?: string,
): ServiceContext {
  return {
    userId: user.id,
    tenantId: tenantId ?? user.tenantId ?? undefined,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
