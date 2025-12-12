"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";

type FAQItem = {
  id: number;
  category: string | null;
  title: string;
  content: string;
  media?: MediaItem[] | null;
};

type MediaItem = {
  kind: "image" | "video";
  url: string;
  name?: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
const siteBase = process.env.NEXT_PUBLIC_SITE_BASE?.replace(/\/$/, "");
const supportLink =
  process.env.NEXT_PUBLIC_SUPPORT_LINK || (siteBase ? `${siteBase}/support` : "https://talk.naver.com/ct/w5z46j#nafullscreen");

// NOTE: /docs is the single source of truth (SSOT) view for FAQ content.
// CS 챗봇이나 다른 클라이언트는 이 페이지에 노출되는 데이터(FAQ + 카테고리)를 기준으로 답변/동기화하도록 유지하세요.
export default function DocsPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const trackEvent = async (payload: Record<string, any>) => {
    try {
      await fetch("/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // ignore analytics failure
    }
  };

  const categoryOptions = useMemo(() => categories.map((c) => c.name), [categories]);

  const grouped = useMemo(() => {
    const groups: Record<string, FAQItem[]> = {};
    faqs.forEach((f) => {
      const key = f.category || "미지정";
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [faqs]);

  const chipCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add(c.name));
    faqs.forEach((f) => set.add(f.category || "미지정"));
    return Array.from(set).sort();
  }, [categories, faqs]);

  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\uac00-\ud7a3]+/gi, "-")
      .replace(/(^-|-$)+/g, "") || "uncategorized";

  const scrollToCategory = (name: string) => {
    const id = `cat-${slugify(name)}`;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const parseMedia = (raw: any): MediaItem[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((m) => {
        const kind = m?.kind === "video" ? "video" : "image";
        const url = typeof m?.url === "string" ? m.url : "";
        const name = typeof m?.name === "string" ? m.name : undefined;
        return url ? { kind, url, name } : null;
      })
      .filter(Boolean) as MediaItem[];
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [faqRes, catRes] = await Promise.all([
        axios.get(`${apiBase}/api/faq/list`, {
          params: {
            query: searchQuery || undefined,
          },
        }),
        axios.get(`${apiBase}/api/category/list`).catch(() => ({ data: { items: [] } })),
      ]);
      setFaqs(faqRes.data?.items ?? []);
      setCategories(catRes.data?.items ?? []);
    } catch (err) {
      console.error(err);
      setErrorMessage("FAQ를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 팔레트
  const colors = {
    bg: "#F0F0EB", // Ivory Medium
    panel: "#FAFAF7", // Ivory Light
    border: "#E5E4DF", // Ivory Dark
    accent: "#CC785C", // Book Cloth
    accentSoft: "#EBD8BC", // Manilla
    text: "#3B3A37",
    subtext: "#6B665C",
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest" style={{ color: colors.subtext }}>
              Docs
            </p>
            <h1 className="text-3xl font-semibold" style={{ color: colors.text }}>
              두 분의 이야기가 더 아름답게 기록될 수 있도록
            </h1>
            <p style={{ color: colors.subtext }}>
              작은 궁금증 하나까지 놓치지 않도록, 당특순이 자주 받은 질문들을 한자리에 담았습니다.
            </p>
          </div>
          <a
            href={supportLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold shadow-md transition hover:-translate-y-[1px]"
            style={{ backgroundColor: "#05d686", color: "white", boxShadow: "0 8px 20px rgba(5, 214, 134, 0.25)" }}
          >
            톡톡하기
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </a>
        </header>

        {errorMessage && (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#CC785C", backgroundColor: "#F6E5DD", color: "#8A3E2A" }}>
            {errorMessage}
          </div>
        )}

        <section
          className="rounded-2xl p-5 shadow-md space-y-4"
          style={{ backgroundColor: colors.panel, border: `1px solid ${colors.border}` }}
        >
          <div className="flex flex-wrap gap-2 items-center">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: "white", border: `1px solid ${colors.border}`, color: colors.text }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0a7 7 0 1 0-9.9-9.9 7 7 0 0 0 9.9 9.9Z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="search"
                placeholder="검색어를 입력하세요"
                className="w-40 text-sm outline-none"
                style={{ backgroundColor: "transparent", color: colors.text }}
              />
            </div>
            <span className="text-xs" style={{ color: colors.subtext }}>
              {faqs.length}건
            </span>
          </div>

          {chipCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {chipCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className="rounded-full px-3 py-1 text-sm shadow-sm transition"
                  style={{
                    backgroundColor: colors.accentSoft,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                  }}
                  title="해당 카테고리 섹션으로 이동"
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          className="rounded-2xl p-5 shadow-md space-y-4"
          style={{ backgroundColor: colors.panel, border: `1px solid ${colors.border}` }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
              FAQ 목록
            </h2>
            {loading && (
              <span className="text-xs" style={{ color: colors.subtext }}>
                불러오는 중...
              </span>
            )}
          </div>
          <div className="space-y-4">
            {grouped.length ? (
              grouped.map(([cat, items]) => (
                <div key={cat} id={`cat-${slugify(cat)}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold" style={{ color: colors.text }}>
                      {cat}
                    </h3>
                    <span className="text-xs" style={{ color: colors.subtext }}>
                      {items.length}건
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl p-4 space-y-2"
                        style={{ backgroundColor: "white", border: `1px solid ${colors.border}` }}
                        onClick={() => trackEvent({ type: "faq_click", faqId: item.id, faqTitle: item.title })}
                      >
                        <h4 className="text-sm font-semibold" style={{ color: colors.text }}>
                          {item.title}
                        </h4>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: colors.text }}>
                          {item.content}
                        </p>
                        {(() => {
                          const mediaList = parseMedia(item.media);
                          if (!mediaList.length) return null;
                          return (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold" style={{ color: colors.subtext }}>
                              첨부
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {mediaList.map((m, idx) =>
                                m.kind === "video" ? (
                                  <video key={`${m.url}-${idx}`} controls className="h-28 w-44 rounded-lg border" style={{ borderColor: colors.border }}>
                                    <source src={m.url} />
                                  </video>
                                ) : (
                                  <img
                                    key={`${m.url}-${idx}`}
                                    src={m.url}
                                    alt={m.name || "첨부 이미지"}
                                    className="h-28 w-28 rounded-lg border object-cover"
                                    style={{ borderColor: colors.border }}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                )
                              )}
                            </div>
                          </div>
                          );
                        })()}
                      </article>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div
                className="rounded-xl border border-dashed px-4 py-6 text-sm"
                style={{ borderColor: colors.border, backgroundColor: colors.panel, color: colors.subtext }}
              >
                FAQ가 없습니다. 관리자 화면(/)에서 FAQ를 생성한 뒤 다시 확인해 주세요.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
