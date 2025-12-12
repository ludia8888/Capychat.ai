import { NextResponse } from "next/server";
import { generateFAQs } from "../../../../lib/faq";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[API] generate-from-logs payload:", {
      raw_text_len: body?.raw_text?.length ?? 0,
    });
    const result = await generateFAQs({
      raw_text: body.raw_text,
      default_category: body.default_category,
    });
    return NextResponse.json({
      items: result.items,
      added_count: result.addedCount,
      skipped_duplicates: result.skippedDuplicates,
      total_after: result.totalAfter,
    });
  } catch (err: any) {
    console.error("generate-from-logs error:", err);
    return NextResponse.json(
      { detail: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
