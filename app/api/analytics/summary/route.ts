import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { Prisma } from "@prisma/client";

const isMissingTable = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";

export async function GET() {
  try {
    const [chatCount, faqClickCount, topFaqs] = await Promise.all([
      prisma.interactionLog.count({ where: { type: "chat_question" } }),
      prisma.interactionLog.count({ where: { type: "faq_click" } }),
      prisma.interactionLog.groupBy({
        by: ["faqId", "faqTitle"],
        where: { type: "faq_click", faqId: { not: null } },
        _count: { faqId: true },
        orderBy: { _count: { faqId: "desc" } },
        take: 5,
      }),
    ]);

    const top = topFaqs.map((row) => ({
      faqId: row.faqId,
      faqTitle: row.faqTitle,
      count: row._count.faqId,
    }));

    return NextResponse.json({ chatCount, faqClickCount, topFaqs: top });
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn("[analytics] InteractionLog table missing; returning zeros");
      return NextResponse.json({ chatCount: 0, faqClickCount: 0, topFaqs: [] });
    }
    console.error("GET /api/analytics/summary error", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
