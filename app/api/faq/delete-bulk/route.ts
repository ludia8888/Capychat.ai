import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { AuthError, requireAdmin } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    const ids: number[] = Array.isArray(body?.ids)
      ? body.ids
          .map((v: unknown) => Number(v))
          .filter((v: number) => !Number.isNaN(v))
      : [];
    if (!ids.length) {
      return NextResponse.json({ detail: "ids array is required" }, { status: 400 });
    }
    console.log("[API] bulk delete ids:", ids);
    const deleted = await prisma.fAQArticle.deleteMany({
      where: { id: { in: ids }, tenantId: user.tenantId },
    });
    if (!deleted.count) {
      return NextResponse.json({ detail: "no matching FAQ found" }, { status: 404 });
    }
    return NextResponse.json({ status: "deleted", count: deleted.count, ids });
  } catch (err: any) {
    console.error("bulk delete error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
