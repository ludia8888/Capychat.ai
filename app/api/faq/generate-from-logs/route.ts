import { NextResponse } from "next/server";
import { generateFAQs } from "../../../../lib/faq";
import { AuthError, requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    console.log("[API] generate-from-logs payload:", {
      raw_text_len: body?.raw_text?.length ?? 0,
    });
    const result = await generateFAQs({
      raw_text: body.raw_text,
      default_category: body.default_category,
      tenantId: user.tenantId,
    });
    return NextResponse.json({
      items: result.items,
      added_count: result.addedCount,
      skipped_duplicates: result.skippedDuplicates,
      total_after: result.totalAfter,
    });
  } catch (err: any) {
    console.error("generate-from-logs error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json(
      { detail: err?.message || "Internal Server Error" },
      { status }
    );
  }
}
