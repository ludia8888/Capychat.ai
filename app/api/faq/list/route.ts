import { NextResponse } from "next/server";
import { listFAQs } from "../../../../lib/faq";
import { resolveTenantId } from "../../../../lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const tenant = await resolveTenantId({ req });
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || undefined;
    const category = searchParams.get("category") || undefined;

    console.log("[API] list query", query, "category", category);
    const items = await listFAQs(query || undefined, category || undefined, tenant.id);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("GET /api/faq/list error:", err);
    const status = err?.status || 500;
    return NextResponse.json({ detail: err?.message || "Failed to load FAQs" }, { status });
  }
}
