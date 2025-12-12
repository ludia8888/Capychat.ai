import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items: categories });
}
