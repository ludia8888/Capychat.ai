import { prisma } from "./db";
import { FAQArticle } from "@prisma/client";
import { normalizeWordSet, similarityScore } from "./similarity";

export type GenerateRequest = {
  raw_text: string;
  default_category?: string | null;
};

export type FAQCreate = {
  category: string | null;
  title: string;
  content: string;
  sourceType?: string | null;
  confidence?: number | null;
};

export type FAQItem = FAQArticle;

export type GenerateResult = {
  items: FAQItem[];
  addedCount: number;
  skippedDuplicates: number;
  totalAfter: number;
};

type CategoryChoice = {
  id: number | null;
  name: string;
  score: number;
};

const PROMPT_TEMPLATE = `너에게 한국어 고객 상담 로그나 Q/A가 뒤섞인 긴 텍스트 뭉치를 준다.

너의 작업:
1) 질문/답변을 문맥으로 최대한 정확히 추출한다. (Q/A 라벨이 없어도 질문과 답변을 짝지어라)
2) 슬래시(/), 쉼표(,), 번호(1., 1-1., 주-2 등)로 여러 질문이 묶여 있으면 각 질문을 분리해 별도 FAQ 항목으로 만든다. 동일 답변을 공유해도 질문별로 분리된 항목을 반환한다.
3) category는 질문 성격을 대표하는 짧은 한 단어/구(예: 배송, 결제, 계정, 환불 등)로 반드시 너(LLM)가 지정한다. 입력에 없으면 추정해 채워라.
4) 아래 JSON 배열만 반환하라. 다른 텍스트를 추가하지 말 것.
[
  { "question": "질문", "answer": "답변", "category": "카테고리", "confidence": 0.0 }
]

아래는 원본 텍스트이다:
---
{raw_text}
---`;

const LLM_CONFIDENCE_THRESHOLD = parseFloat(process.env.LLM_CONFIDENCE_THRESHOLD || "0.0");

async function callLLM(rawText: string, retry = false): Promise<Array<Record<string, any>>> {
  if (!process.env.OPENAI_API_KEY) return [];
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const payload: Record<string, any> = {
    model,
    messages: [
      { role: "system", content: "너는 고객 상담 로그를 FAQ로 추출하는 도우미다. 반드시 JSON 배열만 반환한다." },
      { role: "user", content: PROMPT_TEMPLATE.replace("{raw_text}", rawText) },
    ],
  };
  try {
    console.log("[LLM] request model:", model, "chars:", rawText.length);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };
    if (process.env.OPENAI_ORG_ID) headers["OpenAI-Organization"] = process.env.OPENAI_ORG_ID;
    if (process.env.OPENAI_PROJECT_ID) headers["OpenAI-Project"] = process.env.OPENAI_PROJECT_ID;

    const res = await fetch(`${(process.env.LLM_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text}`);
    }
    const data = await res.json();
    console.log("[LLM] response usage:", data?.usage);
    const content = data.choices?.[0]?.message?.content;
    console.log("[LLM] raw content snippet:", typeof content === "string" ? content.slice(0, 500) : content);
    if (!content) return [];
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      console.log("[LLM] parsed array len:", parsed.length);
      return parsed;
    }
    if (parsed.items && Array.isArray(parsed.items)) {
      console.log("[LLM] parsed items len:", parsed.items.length);
      return parsed.items;
    }
    if (parsed.questions && Array.isArray(parsed.questions)) {
      console.log("[LLM] parsed questions len:", parsed.questions.length);
      return parsed.questions;
    }
    if (parsed.question && parsed.answer) {
      console.log("[LLM] parsed single object -> array wrap");
      return [parsed];
    }
    if (parsed.error && !retry) {
      console.warn("[LLM] format error from model, retrying once with stricter instruction");
      return await callLLM(
        `${rawText}\n\n위 출력이 형식 오류였습니다. 반드시 JSON 배열만 반환하세요.`,
        true
      );
    }
    console.log("[LLM] parsed fallback to empty; keys:", Object.keys(parsed || {}));
    return [];
  } catch (err) {
    console.error("LLM call failed:", err);
    if (!retry) {
      console.warn("[LLM] retrying once after failure");
      return callLLM(`${rawText}\n\n이전 시도가 실패했습니다. 반드시 JSON 배열만 반환하세요.`, true);
    }
    return [];
  }
}

function pickCategory(
  suggested: string | null | undefined,
  defaultCategory: string | null | undefined,
  categories: { id: number; name: string }[]
): CategoryChoice {
  const fallbackName = suggested || defaultCategory || "일반";
  if (!categories.length || !suggested) {
    return { id: null, name: fallbackName, score: 0 };
  }
  let best: CategoryChoice = { id: categories[0].id, name: categories[0].name, score: 0 };
  for (const cat of categories) {
    const score = similarityScore(suggested, cat.name);
    if (score > best.score) {
      best = { id: cat.id, name: cat.name, score };
    }
  }
  // 임계값: 0.4 이상이면 기존 카테고리에 매핑, 아니면 LLM 카테고리 그대로 사용
  if (best.score >= 0.4) {
    return best;
  }
  return { id: null, name: fallbackName, score: 0 };
}

function normalizeFaqItems(rawItems: Array<Record<string, any>>, defaultCategory?: string | null): FAQCreate[] {
  return rawItems.map((item) => {
    const title = item.question || item.title || "제목 없음";
    const content = item.answer || item.content || "";
    const category = item.category ?? defaultCategory ?? "일반";
    return {
      category,
      title,
      content,
      sourceType: item.source_type || "llm_import",
      confidence: typeof item.confidence === "number" ? item.confidence : null,
    };
  });
}

export async function generateFAQs(
  payload: GenerateRequest
): Promise<GenerateResult> {
  const { raw_text, default_category } = payload;
  if (!raw_text?.trim()) {
    throw new Error("raw_text is required");
  }
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  let rawItems = await callLLM(raw_text);
  let prepared: FAQCreate[];
  if (!rawItems.length) {
    prepared = [];
  } else {
    prepared = normalizeFaqItems(rawItems, default_category);
  }

  prepared.forEach((p) => {
    const choice = pickCategory(p.category, default_category, categories);
    p.category = choice.name;
    (p as any).categoryId = choice.id;
  });

  const toInsert = prepared.filter((p) => p.confidence == null || p.confidence >= LLM_CONFIDENCE_THRESHOLD);

  if (!toInsert.length) {
    return {
      items: [],
      addedCount: 0,
      skippedDuplicates: 0,
      totalAfter: await prisma.fAQArticle.count(),
    };
  }

  const created = await prisma.$transaction(
    toInsert.map((item) =>
      prisma.fAQArticle.create({
        data: {
          category: item.category,
          categoryId: (item as any).categoryId ?? null,
          title: item.title,
          content: item.content,
          sourceType: item.sourceType || "llm_import",
          confidence: item.confidence,
        },
      })
    )
  );

  const totalAfter = await prisma.fAQArticle.count();
  return {
    items: created,
    addedCount: created.length,
    skippedDuplicates: 0,
    totalAfter,
  };
}

export async function listFAQs(query?: string, category?: string | null) {
  return prisma.fAQArticle.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { content: { contains: query, mode: "insensitive" } },
              ],
            }
          : {},
        category ? { category } : {},
      ],
    },
    orderBy: { id: "desc" },
  });
}

export async function updateFAQ(id: number, data: Partial<FAQCreate>) {
  const existing = await prisma.fAQArticle.findUnique({ where: { id } });
  if (!existing) throw new Error("FAQ not found");

  let categoryId: number | null | undefined = undefined;
  if (data.category !== undefined) {
    if (data.category === null || data.category === "") {
      categoryId = null;
    } else {
      const cat = await prisma.category.findFirst({
        where: { name: data.category },
      });
      categoryId = cat ? cat.id : null;
    }
  }

  const updated = await prisma.fAQArticle.update({
    where: { id },
    data: {
      title: data.title ?? undefined,
      content: data.content ?? undefined,
      category: data.category ?? undefined,
      categoryId,
      updatedAt: new Date(),
    },
  });
  return updated;
}

export async function deleteFAQ(id: number) {
  await prisma.fAQArticle.delete({ where: { id } });
  return { status: "deleted", id };
}
