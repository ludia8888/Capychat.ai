import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { callChatbotLLM } from "../../../lib/chatbot";
import { getChatSettings } from "../../../lib/config";
import { resolveTenantId } from "../../../lib/tenant";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = (body?.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ detail: "message is required" }, { status: 400 });
    }

    const tenant = await resolveTenantId({ req });

    // 1) SSOT: FAQ 전체 조회 (카테고리 포함)
    const [faqs, chatSettings] = await Promise.all([
      prisma.fAQArticle.findMany({
        where: { tenantId: tenant.id },
        orderBy: { id: "desc" },
        select: { id: true, title: true, content: true, category: true },
      }),
      getChatSettings(tenant.id),
    ]);

    // 2) LLM 호출 (RAG)
    const answer = await callChatbotLLM(message, faqs, chatSettings.systemPrompt);

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("chatbot error:", err);
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json({ detail: err?.message || "Internal Server Error" }, { status });
  }
}
