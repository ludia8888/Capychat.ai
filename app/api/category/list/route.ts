import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { resolveTenantId } from "../../../../lib/tenant";

export async function GET(req: Request) {
  try {
    const tenant = await resolveTenantId({ req });
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
