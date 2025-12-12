import { NextResponse } from "next/server";
import { listFAQs } from "../../../../lib/faq";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || undefined;
  const category = searchParams.get("category") || undefined;

  console.log("[API] list query", query, "category", category);
  const items = await listFAQs(query || undefined, category || undefined);
  return NextResponse.json({ items });
}
