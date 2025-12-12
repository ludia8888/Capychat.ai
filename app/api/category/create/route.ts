import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { AuthError, requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    const name = (body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ detail: "name is required" }, { status: 400 });
    }

    const created = await prisma.category.create({
      data: {
        tenantId: user.tenantId,
        name,
      },
    });
    return NextResponse.json(created);
  } catch (err: any) {
    console.error("create category error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
