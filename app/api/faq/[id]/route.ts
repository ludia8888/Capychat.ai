import { NextResponse } from "next/server";
import { deleteFAQ, updateFAQ } from "../../../../lib/faq";
import { AuthError, requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin();
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ detail: "invalid id" }, { status: 400 });
    }
    const body = await req.json();
    console.log("[API] update faq", id, "payload keys", Object.keys(body || {}));
    const updated = await updateFAQ(id, body, user.tenantId);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("update faq error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    if (err?.message === "FAQ not found") {
      return NextResponse.json({ detail: "FAQ not found" }, { status: 404 });
    }
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin();
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ detail: "invalid id" }, { status: 400 });
    }
    console.log("[API] delete faq", id);
    const res = await deleteFAQ(id, user.tenantId);
    return NextResponse.json(res);
  } catch (err: any) {
    console.error("delete faq error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    if (err?.message === "FAQ not found") {
      return NextResponse.json({ detail: "FAQ not found" }, { status: 404 });
    }
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
