import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { callChatbotLLM } from "../../../lib/chatbot";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = (body?.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ detail: "message is required" }, { status: 400 });
    }

    // 1) SSOT: FAQ 전체 조회 (카테고리 포함)
    const faqs = await prisma.fAQArticle.findMany({
      orderBy: { id: "desc" },
      select: { id: true, title: true, content: true, category: true },
    });

    // 2) LLM 호출 (RAG)
    const answer = await callChatbotLLM(message, faqs);

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("chatbot error:", err);
    return NextResponse.json({ detail: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
