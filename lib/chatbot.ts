import { FAQArticle } from "@prisma/client";
import { normalizeWordSet, similarityScore } from "./similarity";

const SYSTEM_PROMPT = `
당신은 “당특순 CS 챗봇” 당특순입니다.
이름 그대로 “당신의 특별한 순간을 돕는 존재”로서,
예비부부가 걱정 없이 서비스를 사용할 수 있도록
따뜻하고 친절한 말투로 안내하는 전문 웨딩 컨시어지입니다.

페르소나/말투 규칙:
- 따뜻하고 친절한 존댓말
- 간결하지만 인간적인 문장, 과장/명령/인터넷체 금지

응답 규칙:
1) 일반 인사/라이트 토크: 공감형 인사 후 가볍게 안내, FAQ 링크는 붙이지 않는다.
2) 서비스 관련 질문(템플릿, 결제, 환불, 업로드 등): FAQ 매칭 내용으로 답변하고 마지막에
   “더 자세한 안내가 필요하시면 FAQ 문서에서도 편안하게 확인하실 수 있어요. 👉 FAQ 보러가기: {{FAQ_LINK}}”
3) 정보 부족/모호/지원 불가 영역: 공감 → 정보 부족 알림 → 관리자 문의 권유 (FAQ 링크는 붙이지 않고, 👉 관리자에게 직접 문의하기: {{SUPPORT_LINK}}).

답변 스타일:
- 공감 먼저 → 차분한 정보 → 안심시키는 마무리 (예: “천천히 살펴보셔도 괜찮아요.”)

FAQ는 아래 JSON 배열로 제공된다. 사용자가 묻는 내용과 가장 관련 있는 항목으로 답변을 작성하되,
직접적인 매칭이 없으면 관리자 문의 안내를 한다.
`.trim();

const FAQ_LINK = process.env.NEXT_PUBLIC_SITE_BASE
  ? `${process.env.NEXT_PUBLIC_SITE_BASE.replace(/\/$/, "")}/docs`
  : "http://localhost:3000/docs";
// Real-time support is removed; keep a mock link placeholder for any “관리자 문의” 안내.
const SUPPORT_LINK = "https://example.com/support";

type Retrieved = Pick<FAQArticle, "id" | "title" | "content" | "category"> & { score: number };

export async function callChatbotLLM(
  message: string,
  faqs: Pick<FAQArticle, "title" | "content" | "category" | "id">[]
) {
  const msgNorm = message.toLowerCase();

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
        content: SYSTEM_PROMPT.replace("{{FAQ_LINK}}", FAQ_LINK).replace("{{SUPPORT_LINK}}", SUPPORT_LINK),
      },
      {
        role: "user",
        content: userPrompt.replace("{{FAQ_LINK}}", FAQ_LINK).replace("{{SUPPORT_LINK}}", SUPPORT_LINK),
      },
    ],
  };

  try {
    const res = await fetch(`${(process.env.LLM_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || "죄송합니다. 잠시 후 다시 시도해 주세요.";
  } catch (err) {
    console.error("callChatbotLLM error:", err);
    return "죄송합니다. 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.";
  }
}
