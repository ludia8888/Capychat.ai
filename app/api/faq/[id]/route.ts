import { NextResponse } from "next/server";
import { deleteFAQ, updateFAQ } from "../../../../lib/faq";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    console.log("[API] update faq", params.id, "payload keys", Object.keys(body || {}));
    const updated = await updateFAQ(Number(params.id), body);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("update faq error:", err);
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    console.log("[API] delete faq", params.id);
    const res = await deleteFAQ(Number(params.id));
    return NextResponse.json(res);
  } catch (err: any) {
    console.error("delete faq error:", err);
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
