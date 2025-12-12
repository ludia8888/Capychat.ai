import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { Prisma } from "@prisma/client";
import { AuthError, requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isMissingTable = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";

export async function GET() {
  try {
    const user = await requireAdmin();
    const [chatCount, faqClickCount, topFaqsAll, daily, weekly, monthly, topFaqsMonthly, recentQuestions] = await Promise.all([
      prisma.interactionLog.count({ where: { type: "chat_question", tenantId: user.tenantId } }),
      prisma.interactionLog.count({ where: { type: "faq_click", tenantId: user.tenantId } }),
      prisma.interactionLog.groupBy({
        by: ["faqId", "faqTitle"],
        where: { type: "faq_click", faqId: { not: null }, tenantId: user.tenantId },
        _count: { faqId: true },
        orderBy: { _count: { faqId: "desc" } },
        take: 5,
      }),
      prisma.$queryRaw<
        { bucket: Date; count: number }[]
      >`SELECT DATE("createdAt") as bucket, COUNT(*)::int as count FROM "InteractionLog" WHERE "type" = 'chat_question' AND "tenantId" = ${user.tenantId} AND "createdAt" >= NOW() - interval '14 days' GROUP BY bucket ORDER BY bucket`,
      prisma.$queryRaw<
        { bucket: Date; count: number }[]
      >`SELECT date_trunc('week',"createdAt")::date as bucket, COUNT(*)::int as count FROM "InteractionLog" WHERE "type" = 'chat_question' AND "tenantId" = ${user.tenantId} AND "createdAt" >= NOW() - interval '12 weeks' GROUP BY bucket ORDER BY bucket`,
      prisma.$queryRaw<
        { bucket: Date; count: number }[]
      >`SELECT date_trunc('month',"createdAt")::date as bucket, COUNT(*)::int as count FROM "InteractionLog" WHERE "type" = 'chat_question' AND "tenantId" = ${user.tenantId} AND "createdAt" >= NOW() - interval '12 months' GROUP BY bucket ORDER BY bucket`,
      prisma.interactionLog.groupBy({
        by: ["faqId", "faqTitle"],
        where: {
          type: "faq_click",
          faqId: { not: null },
          tenantId: user.tenantId,
          createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
        },
        _count: { faqId: true },
        orderBy: { _count: { faqId: "desc" } },
        take: 5,
      }),
      prisma.interactionLog.findMany({
        where: {
          type: "chat_question",
          message: { not: null },
          tenantId: user.tenantId,
          createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
        },
        select: { message: true },
        take: 500,
      }),
    ]);

    const topFaqs = topFaqsAll.map((row) => ({
      faqId: row.faqId,
      faqTitle: row.faqTitle,
      count: row._count.faqId,
    }));

    const topFaqs30d = topFaqsMonthly.map((row) => ({
      faqId: row.faqId,
      faqTitle: row.faqTitle,
      count: row._count.faqId,
    }));

    // Aggregate top questions from recent logs
    const questionCounter = new Map<string, number>();
    recentQuestions.forEach((r) => {
      const key = (r.message ?? "").trim();
      if (!key) return;
      questionCounter.set(key, (questionCounter.get(key) ?? 0) + 1);
    });
    const topQuestions = Array.from(questionCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return NextResponse.json({
      chatCount,
      faqClickCount,
      topFaqs,
      topFaqs30d,
      topQuestions,
      chatTrends: {
        daily: daily.map((d) => ({ bucket: d.bucket, count: Number(d.count) })),
        weekly: weekly.map((d) => ({ bucket: d.bucket, count: Number(d.count) })),
        monthly: monthly.map((d) => ({ bucket: d.bucket, count: Number(d.count) })),
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: err?.status || 401 });
    }
    if (isMissingTable(err)) {
      console.warn("[analytics] InteractionLog table missing; returning zeros");
      return NextResponse.json({
        chatCount: 0,
        faqClickCount: 0,
        topFaqs: [],
        topFaqs30d: [],
        topQuestions: [],
        chatTrends: { daily: [], weekly: [], monthly: [] },
      });
    }
    console.error("GET /api/analytics/summary error", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
