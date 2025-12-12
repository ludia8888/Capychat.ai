import { NextResponse } from "next/server";
import { createFAQ } from "../../../../lib/faq";
import { AuthError, requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    if (!body?.title || !body?.content) {
      return NextResponse.json({ detail: "title and content are required" }, { status: 400 });
    }
    const created = await createFAQ(body, user.tenantId);
    return NextResponse.json(created);
  } catch (err: any) {
    console.error("create faq error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
