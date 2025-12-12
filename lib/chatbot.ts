import { FAQArticle } from "@prisma/client";
import { similarityScore } from "./similarity";
import { DEFAULT_SYSTEM_PROMPT } from "./chatbotPrompt";

const FAQ_LINK = process.env.NEXT_PUBLIC_SITE_BASE
  ? `${process.env.NEXT_PUBLIC_SITE_BASE.replace(/\/$/, "")}/docs`
  : "http://localhost:3000/docs";
// 관리자 문의는 지정된 톡 링크로 연결한다. 환경변수가 있으면 우선한다.
const SUPPORT_LINK = process.env.NEXT_PUBLIC_SUPPORT_LINK || "https://talk.naver.com/ct/w5z46j#nafullscreen";
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || "15000");

type AppError = Error & { status?: number };

const withStatus = (message: string, status: number): AppError => {
  const err = new Error(message) as AppError;
  err.status = status;
  return err;
};

type Retrieved = Pick<FAQArticle, "id" | "title" | "content" | "category"> & { score: number };

export async function callChatbotLLM(
  message: string,
  faqs: Pick<FAQArticle, "title" | "content" | "category" | "id">[],
  systemPrompt?: string
  ) {
  const msgNorm = message.toLowerCase();
  const promptText = (systemPrompt || DEFAULT_SYSTEM_PROMPT || "").trim() || DEFAULT_SYSTEM_PROMPT;
  if (!process.env.OPENAI_API_KEY) {
    throw withStatus("OPENAI_API_KEY is missing", 503);
  }

  // 1) retrieve: 유사도 + 부분문자열 부스팅
  const scored: Retrieved[] = faqs.map((f) => {
    const titleScore = similarityScore(message, f.title);
    const contentScore = similarityScore(message, f.content);
    const catScore = f.category ? similarityScore(message, f.category) : 0;
    const substringBoost =
      (f.title.toLowerCase().includes(msgNorm) ? 0.4 : 0) +
      (f.content.toLowerCase().includes(msgNorm) ? 0.4 : 0);
    return {
      ...f,
      score: Math.max(titleScore, contentScore, catScore) + substringBoost,
    };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score ?? 0;
  // 스코어가 낮으면 더 많은 문맥을 제공 (작은 데이터셋이므로 안전)
  const top = (maxScore < 0.2 ? sorted.slice(0, 12) : sorted.slice(0, 6)) as Retrieved[];

  const context = top
    .map(
      (f, idx) =>
        `#${idx + 1} [카테고리:${f.category ?? "미지정"}] Q: ${f.title}\nA: ${f.content}`
    )
    .join("\n\n");

  const userPrompt = `
사용자 질문: ${message}

관련 FAQ (최대 6개):
${context || "없음"}

규칙을 준수하여 한국어로 답변하세요. 서비스 관련 시 FAQ 링크를 포함하고, 일반 인사/모호/지원불가 시 규칙에 따라 대응하세요.
FAQ 링크는 ${FAQ_LINK} 입니다.
`.trim();

  const payload = {
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: promptText.replace("{{FAQ_LINK}}", FAQ_LINK).replace("{{SUPPORT_LINK}}", SUPPORT_LINK),
      },
      {
        role: "user",
        content: userPrompt.replace("{{FAQ_LINK}}", FAQ_LINK).replace("{{SUPPORT_LINK}}", SUPPORT_LINK),
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${(process.env.LLM_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw withStatus(`LLM HTTP ${res.status}${text ? `: ${text}` : ""}`, 502);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw withStatus("LLM response empty", 502);
    }
    return content;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw withStatus("LLM request timed out", 504);
    }
    if (err?.status) throw err;
    throw withStatus(err?.message || "LLM request failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}
