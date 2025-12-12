import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = (body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ detail: "name is required" }, { status: 400 });
    }

    const created = await prisma.category.create({
      data: {
        name,
      },
    });
    return NextResponse.json(created);
  } catch (err: any) {
    console.error("create category error:", err);
    return NextResponse.json({ detail: err?.message || "Error" }, { status: 500 });
  }
}
