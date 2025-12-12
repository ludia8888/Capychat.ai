import { prisma } from "./db";
import { FAQArticle } from "@prisma/client";
import { similarityScore } from "./similarity";

export type GenerateRequest = {
  raw_text: string;
  default_category?: string | null;
  tenantId: number;
};

export type FAQCreate = {
  category: string | null;
  title: string;
  content: string;
  sourceType?: string | null;
  confidence?: number | null;
  media?: MediaItem[];
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
1) 어떤 형식의 문서이든 질문/답변으로 분리한다.
2) 질문/답변을 문맥으로 최대한 정확히 추출한다. (Q/A 라벨이 없어도 질문과 답변을 짝지어라)
3) 슬래시(/), 쉼표(,), 번호(1., 1-1., 주-2 등)로 여러 질문이 묶여 있으면 각 질문을 분리해 별도 FAQ 항목으로 만든다. 동일 답변을 공유해도 질문별로 분리된 항목을 반환한다.
4) category는 질문 성격을 대표하는 짧은 한 단어/구(예: 배송, 결제, 계정, 환불 등)로 반드시 너(LLM)가 지정한다. 입력에 없으면 추정해 채워라.
5) confidence는 0~1 사이 실수로 채워라. 보통 0.6~0.9 사이 값으로 작성하고, 매우 확실할 때만 0.95 이상, 불확실하지만 추정 가능할 때는 0.55~0.6을 사용한다. 0이나 1은 사용하지 않는다.
6) 아래 JSON 배열만 반환하라. 다른 텍스트를 추가하지 말 것.
[
  { "question": "질문", "answer": "답변", "category": "카테고리", "confidence": 0.78 }
]

아래는 원본 텍스트이다:
--- 
{raw_text}
---`;

const LLM_CONFIDENCE_THRESHOLD = parseFloat(process.env.LLM_CONFIDENCE_THRESHOLD || "0.0");
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || "15000");

type AppError = Error & { status?: number };

const withStatus = (message: string, status: number): AppError => {
  const err = new Error(message) as AppError;
  err.status = status;
  return err;
};

const normalizeMedia = (raw: any): MediaItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      const url = typeof m?.url === "string" ? m.url : "";
      if (!url) return null;
      const kind: "image" | "video" = m?.kind === "video" ? "video" : "image";
      const name = typeof m?.name === "string" ? m.name : undefined;
      return { kind, url, name };
    })
    .filter(Boolean) as MediaItem[];
};

async function callLLM(rawText: string): Promise<Array<Record<string, any>>> {
  if (!process.env.OPENAI_API_KEY) {
    throw withStatus("OPENAI_API_KEY is missing", 503);
  }

  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const payload: Record<string, any> = {
    model,
    messages: [
      { role: "system", content: "너는 고객 상담 로그를 FAQ로 추출하는 도우미다. 반드시 JSON 배열만 반환한다." },
      { role: "user", content: PROMPT_TEMPLATE.replace("{raw_text}", rawText) },
    ],
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };
  if (process.env.OPENAI_ORG_ID) headers["OpenAI-Organization"] = process.env.OPENAI_ORG_ID;
  if (process.env.OPENAI_PROJECT_ID) headers["OpenAI-Project"] = process.env.OPENAI_PROJECT_ID;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    console.log("[LLM] request model:", model, "chars:", rawText.length);
    const res = await fetch(`${(process.env.LLM_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw withStatus(`LLM HTTP ${res.status}${text ? `: ${text}` : ""}`, 502);
    }
    const data = await res.json();
    console.log("[LLM] response usage:", data?.usage);
    const content = data.choices?.[0]?.message?.content;
    console.log("[LLM] raw content snippet:", typeof content === "string" ? content.slice(0, 500) : content);
    if (!content) {
      throw withStatus("LLM response empty", 502);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw withStatus("LLM response is not valid JSON", 502);
    }

    if (Array.isArray(parsed)) return parsed;
    if (parsed?.items && Array.isArray(parsed.items)) return parsed.items;
    if (parsed?.questions && Array.isArray(parsed.questions)) return parsed.questions;
    if (parsed?.question && parsed?.answer) return [parsed];

    throw withStatus("LLM response has unexpected shape", 502);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw withStatus("LLM request timed out", 504);
    }
    if (err?.status) throw err;
    throw withStatus(err?.message || "LLM call failed", 502);
  } finally {
    clearTimeout(timeout);
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
    let confidence: number | null = typeof item.confidence === "number" ? item.confidence : null;
    // Fallback: 0 또는 비어있을 때는 기본 0.6으로 채워 필터링을 통과하도록 한다.
    if (confidence !== null && confidence <= 0) confidence = 0.6;
    return {
      category,
      title,
      content,
      sourceType: item.source_type || "llm_import",
      confidence,
      media: Array.isArray(item.media)
        ? item.media
          .map((m) => ({
            kind: (m.kind === "video" ? "video" : "image") as "image" | "video",
            url: typeof m.url === "string" ? m.url : "",
            name: typeof m.name === "string" ? m.name : undefined,
          }))
          .filter((m) => !!m.url)
        : [],
    };
  });
}

export async function generateFAQs(
  payload: GenerateRequest
): Promise<GenerateResult> {
  const { raw_text, default_category, tenantId } = payload;
  if (!raw_text?.trim()) {
    throw new Error("raw_text is required");
  }
  const categories = await prisma.category.findMany({
    where: { tenantId },
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
      totalAfter: await prisma.fAQArticle.count({ where: { tenantId } }),
    };
  }

  const created = await prisma.$transaction(
    toInsert.map((item) =>
      prisma.fAQArticle.create({
        data: {
          tenantId,
          category: item.category,
          categoryId: (item as any).categoryId ?? null,
          title: item.title,
          content: item.content,
          media: item.media ?? [],
          sourceType: item.sourceType || "llm_import",
          confidence: item.confidence,
        },
      })
    )
  );

  const totalAfter = await prisma.fAQArticle.count({ where: { tenantId } });
  return {
    items: created,
    addedCount: created.length,
    skippedDuplicates: 0,
    totalAfter,
  };
}

export async function listFAQs(query: string | undefined, category: string | null | undefined, tenantId: number) {
  return prisma.fAQArticle.findMany({
    where: {
      AND: [
        { tenantId },
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

export async function createFAQ(data: FAQCreate, tenantId: number) {
  if (!data.title?.trim() || !data.content?.trim()) {
    throw new Error("title and content are required");
  }

  let categoryId: number | null = null;
  if (data.category) {
    const cat = await prisma.category.findFirst({ where: { name: data.category, tenantId } });
    categoryId = cat ? cat.id : null;
  }

  const created = await prisma.fAQArticle.create({
    data: {
      tenantId,
      title: data.title,
      content: data.content,
      category: data.category,
      categoryId,
      media: normalizeMedia(data.media),
      sourceType: data.sourceType || "manual",
      confidence: data.confidence,
    },
  });
  return created;
}

export async function updateFAQ(id: number, data: Partial<FAQCreate>, tenantId: number) {
  const existing = await prisma.fAQArticle.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenantId) throw new Error("FAQ not found");

  let categoryId: number | null | undefined = undefined;
  if (data.category !== undefined) {
    if (data.category === null || data.category === "") {
      categoryId = null;
    } else {
      const cat = await prisma.category.findFirst({
        where: { name: data.category, tenantId },
      });
      categoryId = cat ? cat.id : null;
    }
  }

  const normalizedMedia = data.media === undefined ? undefined : normalizeMedia(data.media);

  const updated = await prisma.fAQArticle.update({
    where: { id },
    data: {
      tenantId,
      title: data.title ?? undefined,
      content: data.content ?? undefined,
      category: data.category ?? undefined,
      media: normalizedMedia,
      categoryId,
      updatedAt: new Date(),
    },
  });
  return updated;
}

export async function deleteFAQ(id: number, tenantId: number) {
  const existing = await prisma.fAQArticle.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenantId) {
    throw new Error("FAQ not found");
  }
  await prisma.fAQArticle.delete({ where: { id } });
  return { status: "deleted", id };
}
export type MediaItem = {
  kind: "image" | "video";
  url: string;
  name?: string;
};
