import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getUserFromCookies } from "../../../../lib/auth";
import { resolveTenantId } from "../../../../lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const user = await getUserFromCookies();
    const tenant = await resolveTenantId({ tenantIdFromUser: user?.tenantId, req });
    const categories = await prisma.category.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ items: categories });
  } catch (err: any) {
    console.error("GET /api/category/list error:", err);
    const status = err?.status || 500;
    return NextResponse.json({ detail: err?.message || "Failed to load categories" }, { status });
  }
}
