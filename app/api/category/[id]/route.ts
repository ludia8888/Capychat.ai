import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const name = (body?.name ?? "").trim();
    if (!name) return NextResponse.json({ detail: "name is required" }, { status: 400 });
    const updated = await prisma.category.update({
      where: { id: Number(params.id) },
      data: { name },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("update category error:", err);
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.category.delete({ where: { id: Number(params.id) } });
    return NextResponse.json({ status: "deleted", id: Number(params.id) });
  } catch (err: any) {
    console.error("delete category error:", err);
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
