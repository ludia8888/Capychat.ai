import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function POST(req: Request) {
  try {
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
      where: { id: { in: ids } },
    });
    return NextResponse.json({ status: "deleted", count: deleted.count, ids });
  } catch (err: any) {
    console.error("bulk delete error:", err);
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
