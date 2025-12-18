"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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

export default function DocsClient({ tenantKey }: { tenantKey: string }) {
  const supportLink = `/chatbot?tenant=${encodeURIComponent(tenantKey)}`;
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const trackEvent = async (payload: Record<string, any>) => {
    try {
      await fetch(`/api/analytics/events?tenant=${encodeURIComponent(tenantKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // ignore analytics failure
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
            tenant: tenantKey,
          },
        }),
        axios.get(`${apiBase}/api/category/list`, { params: { tenant: tenantKey } }).catch(() => ({ data: { items: [] } })),
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
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!lightbox) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox]);

  // Sort FAQs: Category first, then Title ?? Or just keep API order?
  // Let's sort by Category Name then Title for clean grouping visually
  const sortedFaqs = useMemo(() => {
    return [...faqs].sort((a, b) => {
      const catA = a.category || "zzz"; // Put uncategorized last
      const catB = b.category || "zzz";
      if (catA !== catB) return catA.localeCompare(catB);
      return a.title.localeCompare(b.title);
    });
  }, [faqs]);

  const chipCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add(c.name));
    faqs.forEach((f) => set.add(f.category || "기타"));
    return Array.from(set).sort();
  }, [categories, faqs]);

  const scrollToCategory = (category: string) => {
    // We will attach an ID to the first item of each category in the list
    // The ID format will be `cat-start-${category}`
    // We need to handle special chars like before? standard slugify better.
    // For simplicity let's just use encoded URI component or simple replacement if needed.
    // Let's stick to the previous slugify logic or simple finding by data attribute.

    // Actually, finding the element by ID is easiest.
    // Let's rely on the rendering loop to adding ids.
    const slug = category.replace(/\s+/g, '-');
    const el = document.getElementById(`cat-start-${slug}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Optionally flash it?
    }
  };

  const colors = {
    bg: "#F0F0EB",
    text: "#3B3A37",
    subtext: "#6B665C",
    border: "#E5E4DF",
    hover: "#FAFAF7",
  };

  // Predefined badge colors (randomized assignment based on category string)
  // Using muted, earth-tone colors to blend with the #F0F0EB background
  const getBadgeColor = (category: string) => {
    const styles = [
      { bg: "#E8D5C4", text: "#5C4033", border: "#D4C0AF" }, // Muted Terra Cotta
      { bg: "#D4E0D9", text: "#2F4F4F", border: "#BFD0C4" }, // Muted Sage
      { bg: "#D1D9E6", text: "#36454F", border: "#BCC6D6" }, // Muted Slate Blue
      { bg: "#E6D1D1", text: "#5C3333", border: "#D6BDBD" }, // Muted Rose
      { bg: "#E0D4E6", text: "#4B365F", border: "#CDBDD6" }, // Muted Lavender
      { bg: "#D9D2C5", text: "#4A4036", border: "#C4BCAD" }, // Muted Khaki
      { bg: "#CBD6D6", text: "#3A4A4A", border: "#B6C4C4" }, // Muted Blue Gray
    ];
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % styles.length;
    return styles[idx];
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg, color: colors.text }}>
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest" style={{ color: colors.subtext }}>
              Docs
            </p>
            <h1 className="text-3xl font-semibold" style={{ color: colors.text }}>
              자주 묻는 질문
            </h1>
            <p style={{ color: colors.subtext }}>
              궁금한 점을 검색하거나 목록에서 찾아보세요.
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

        <div className="flex flex-col gap-4">
          {/* Search Box */}
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="search"
              placeholder="검색어 입력..."
              className="w-full sm:w-80 rounded-full px-5 py-3 text-sm border shadow-sm outline-none transition focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 pl-11"
              style={{ backgroundColor: "white", borderColor: colors.border }}
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0a7 7 0 1 0-9.9-9.9 7 7 0 0 0 9.9 9.9Z" />
            </svg>
          </div>

          {/* Category Chips */}
          {chipCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chipCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition hover:brightness-95 active:scale-95 bg-white border"
                  style={{
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-xl border px-4 py-3 text-sm text-red-600 bg-red-50 border-red-100">
            {errorMessage}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: colors.border }}>
          {/* Table Header */}
          <div className="flex border-b text-xs font-semibold uppercase tracking-wider bg-gray-50" style={{ borderColor: colors.border, color: colors.subtext }}>
            <div className="w-24 md:w-32 px-6 py-3 shrink-0">분류</div>
            <div className="px-6 py-3 flex-1 flex items-center gap-2">
              <span>Aa</span> 이름
            </div>
          </div>

          {/* List */}
          <div className="divide-y" style={{ borderColor: colors.border }}>
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
            ) : sortedFaqs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                검색 결과가 없거나 FAQ가 등록되지 않았습니다.
              </div>
            ) : (
              sortedFaqs.map((item, index) => {
                const isExpanded = expandedIds.has(item.id);
                const badgeStyle = getBadgeColor(item.category || "기타");

                // Check if this is the first item of this category
                const prevCtx = index > 0 ? sortedFaqs[index - 1].category || "기타" : null;
                const currentCtx = item.category || "기타";
                const isFirstOfCategory = index === 0 || prevCtx !== currentCtx;
                const anchorId = isFirstOfCategory ? `cat-start-${currentCtx.replace(/\s+/g, '-')}` : undefined;

                return (
                  <div key={item.id} id={anchorId} className="group transition-colors hover:bg-gray-50">
                    {/* Question Row */}
                    <div
                      className="flex items-start md:items-center cursor-pointer py-4"
                      onClick={() => {
                        toggleExpand(item.id);
                        if (!isExpanded) trackEvent({ type: "faq_click", faqId: item.id, faqTitle: item.title });
                      }}
                    >
                      {/* Category Badge */}
                      <div className="w-24 md:w-32 px-6 shrink-0 pt-0.5 md:pt-0">
                        <span
                          className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium border"
                          style={{
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.text,
                            borderColor: badgeStyle.border
                          }}
                        >
                          {item.category || "기타"}
                        </span>
                      </div>

                      {/* Title */}
                      <div className="px-6 flex-1 flex gap-3 text-[15px] font-medium leading-normal items-start md:items-center">
                        <span className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mt-0.5 md:mt-0 ${isExpanded ? "bg-black text-white" : "text-red-500 bg-red-100"}`}>
                          ?
                        </span>
                        <span style={{ color: colors.text }}>
                          {item.title}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Answer Section */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t" style={{ borderColor: colors.border }}>
                        <div className="px-6 py-6 pl-10 md:pl-[calc(8rem+1.5rem)] pr-6 md:pr-10">
                          <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap leading-relaxed">
                            {item.content}
                          </div>

                          {/* Media Attachments */}
                          {(() => {
                            const mediaList = parseMedia(item.media);
                            if (!mediaList.length) return null;
                            return (
                              <div className="mt-4 pt-4 border-t border-gray-200/60">
                                <p className="text-xs font-medium text-gray-400 mb-2">첨부파일</p>
                                <div className="flex flex-wrap gap-3">
                                  {mediaList.map((m, idx) =>
                                    m.kind === "video" ? (
                                      <video key={idx} controls className="h-40 rounded-lg border bg-black/5" src={m.url} />
                                    ) : (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          setLightbox({ src: m.url, alt: m.name || "attachment" });
                                        }}
                                        className="h-40 rounded-lg border bg-white overflow-hidden cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                                      >
                                        <img src={m.url} alt={m.name || "attachment"} className="h-40 w-auto object-cover" />
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {lightbox &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="이미지 크게 보기"
            onClick={() => setLightbox(null)}
          >
            <button
              type="button"
              aria-label="닫기"
              autoFocus
              className="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/80"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(null);
              }}
            >
              <X size={18} />
            </button>
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              className="max-h-[85vh] max-w-[95vw] rounded-xl bg-white shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
