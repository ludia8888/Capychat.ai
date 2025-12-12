import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
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
    const name = (body?.name ?? "").trim();
    if (!name) return NextResponse.json({ detail: "name is required" }, { status: 400 });

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ detail: "category not found" }, { status: 404 });
    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json({ detail: "category not found" }, { status: 404 });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("update category error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
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
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ detail: "category not found" }, { status: 404 });
    if (existing.tenantId !== user.tenantId) return NextResponse.json({ detail: "category not found" }, { status: 404 });

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ status: "deleted", id });
  } catch (err: any) {
    console.error("delete category error:", err);
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ detail: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
