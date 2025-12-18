import { prisma } from "./db";
import { AuthError } from "./auth";

const defaultTenantKey = () => process.env.NEXT_PUBLIC_TENANT_KEY || "default";

export async function resolveTenantId(opts: {
  tenantIdFromUser?: number | null;
  req?: Request;
}): Promise<{ id: number; key: string }> {
  if (opts.tenantIdFromUser) {
    const t = await prisma.tenant.findUnique({ where: { id: opts.tenantIdFromUser } });
    if (!t) throw new AuthError("Tenant not found", 403);
    return { id: t.id, key: t.key };
  }

  const req = opts.req;
  const url = req ? new URL(req.url) : null;
  const key =
    (url ? url.searchParams.get("code") : null) ||
    (url ? url.searchParams.get("installCode") : null) ||
    (url ? url.searchParams.get("channel") : null) ||
    (url ? url.searchParams.get("tenant") : null) ||
    (req ? req.headers.get("x-capychat-code") : null) ||
    (req ? req.headers.get("x-tenant-key") : null) ||
    defaultTenantKey();

  let tenant = await prisma.tenant.findUnique({ where: { key } });
  // Fallback: allow resolving by tenant name as well (useful for human-friendly embeds).
  if (!tenant) {
    tenant = await prisma.tenant.findFirst({ where: { name: key } });
  }
  if (!tenant) {
    throw new AuthError("Tenant not found", 404);
  }
  return { id: tenant.id, key: tenant.key };
}
