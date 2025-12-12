"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "../../lib/chatbotPrompt";

type FAQItem = {
  id: number;
  category: string | null;
  title: string;
  content: string;
  sourceType?: string | null;
  confidence?: number | null;
  media?: MediaItem[] | null;
};

type MediaItem = {
  kind: "image" | "video";
  url: string;
  name?: string;
};

const snippet = (text: string, max = 80) => (text && text.length > max ? `${text.slice(0, max - 3)}...` : text);
const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";

export default function AdminPage() {
  const ui = {
    bg: "#F5EFE6",
    panel: "#FFF9F2",
    border: "#E6D9C8",
    accent: "#CC785C",
    accentSoft: "#EBD8BC",
    text: "#2F2A25",
    muted: "#6B665C",
  };

  // FAQ state
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedFaq, setSelectedFaq] = useState<FAQItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editMedia, setEditMedia] = useState<MediaItem[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [lastAddedCount, setLastAddedCount] = useState<number | null>(null);
  const [lastSkippedCount, setLastSkippedCount] = useState<number | null>(null);
  const [lastTotalCount, setLastTotalCount] = useState<number | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "category">("category");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingCategories, setEditingCategories] = useState<Record<number, string>>({});
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [generationNote, setGenerationNote] = useState("");
  const [analytics, setAnalytics] = useState<{ chat: number; faq: number; topFaqs: { faqId: number | null; faqTitle: string | null; count: number }[] }>({
    chat: 0,
    faq: 0,
    topFaqs: [],
  });
  const [chatHeaderText, setChatHeaderText] = useState("");
  const [chatThumbnailUrl, setChatThumbnailUrl] = useState("");
  const [chatThumbnailDataUrl, setChatThumbnailDataUrl] = useState("");
  const [chatSystemPrompt, setChatSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [thumbnailFileName, setThumbnailFileName] = useState("");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaKind, setNewMediaKind] = useState<"image" | "video">("image");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const categoryOptions = useMemo(() => categories.map((c) => c.name), [categories]);
  const groupedFaqs = useMemo(() => {
    const groups: Record<string, FAQItem[]> = {};
    faqs.forEach((f) => {
      const key = f.category || "미지정";
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [faqs]);

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

  const selectFaq = (item: FAQItem) => {
    setSelectedFaq(item);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditCategory(item.category ?? "");
    setEditMedia(parseMedia(item.media));
    setIsCreating(false);
    setSuccessMessage("");
    setEditingCategories((prev) => ({ ...prev, [item.id]: item.category ?? "" }));
  };

  const clearSelection = () => {
    setSelectedFaq(null);
    setEditTitle("");
    setEditContent("");
    setEditCategory("");
    setEditMedia([]);
    setIsCreating(false);
    setSelectedIds(new Set());
  };

  const startCreate = () => {
    setIsCreating(true);
    setSelectedFaq(null);
    setEditTitle("");
    setEditContent("");
    setEditCategory("");
    setEditMedia([]);
    setSelectedIds(new Set());
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleGenerate = async () => {
    if (!rawText.trim()) {
      setErrorMessage("상담 로그를 입력해주세요.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = { raw_text: rawText, default_category: null };
      const { data } = await axios.post(`${apiBase}/api/faq/generate-from-logs`, payload);
      const items = Array.isArray(data) ? data : data?.items ?? [];
      const added = data?.added_count ?? items.length ?? 0;
      const skipped = data?.skipped_duplicates ?? 0;
      setLastAddedCount(added);
      setLastSkippedCount(skipped);
      setLastTotalCount(data?.total_after ?? lastTotalCount);
      setLastRunAt(new Date().toLocaleTimeString());
      if (added === 0) {
        setGenerationNote("신규 항목이 0건입니다. 입력 텍스트가 FAQ 형식이 아니었거나 LLM confidence 필터(기본 0.5)로 모두 제외되었을 수 있습니다. 필요하면 .env의 LLM_CONFIDENCE_THRESHOLD를 낮춰보세요.");
      } else {
        setGenerationNote("");
      }
      await Promise.all([handleFetch(), fetchCategories()]);
      if (items[0]) selectFaq(items[0]);
      setSuccessMessage(
        `FAQ 반영 완료: 신규 ${added}건, 미반영 ${skipped}건${(data?.total_after ?? lastTotalCount) ? ` · 총 ${data?.total_after ?? lastTotalCount}건` : ""}`
      );
    } catch (err) {
      console.error(err);
      setErrorMessage("FAQ 생성 요청에 실패했습니다. 서버 설정을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    setRefreshing(true);
    setErrorMessage("");
    try {
      const { data } = await axios.get(`${apiBase}/api/faq/list`, {
        params: {
          query: searchQuery || undefined,
          category: categoryFilter || undefined,
        },
      });
      setFaqs(data?.items ?? []);
      setLastTotalCount((data?.items ?? []).length);
      if ((data?.items ?? []).length && selectedFaq) {
        const found = data.items.find((f: FAQItem) => f.id === selectedFaq.id);
        if (found) selectFaq(found);
        else setSelectedFaq(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("FAQ 목록을 불러오지 못했습니다.");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get(`${apiBase}/api/category/list`);
      setCategories(data?.items ?? []);
    } catch (err) {
      console.error(err);
      setErrorMessage("카테고리 목록을 불러오지 못했습니다.");
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { data } = await axios.get(`${apiBase}/api/analytics/summary`);
      setAnalytics({
        chat: data?.chatCount ?? 0,
        faq: data?.faqClickCount ?? 0,
        topFaqs: data?.topFaqs ?? [],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const loadChatSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data } = await axios.get(`${apiBase}/api/config/chat`);
      setChatHeaderText(data?.settings?.headerText ?? "");
      setChatThumbnailUrl(data?.settings?.thumbnailUrl ?? "");
      setChatThumbnailDataUrl(data?.settings?.thumbnailDataUrl ?? "");
      const promptFromServer = typeof data?.settings?.systemPrompt === "string" ? data.settings.systemPrompt.trim() : "";
      setChatSystemPrompt(promptFromServer || DEFAULT_SYSTEM_PROMPT);
      setThumbnailFileName("");
    } catch (err) {
      console.error(err);
      setErrorMessage("챗봇 설정을 불러오지 못했습니다.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveChatSettings = async () => {
    setSettingsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        headerText: chatHeaderText,
        thumbnailUrl: chatThumbnailUrl,
        thumbnailDataUrl: chatThumbnailDataUrl,
        systemPrompt: chatSystemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
      };
      const { data } = await axios.put(`${apiBase}/api/config/chat`, payload);
      setChatHeaderText(data?.settings?.headerText ?? "");
      setChatThumbnailUrl(data?.settings?.thumbnailUrl ?? "");
      setChatThumbnailDataUrl(data?.settings?.thumbnailDataUrl ?? "");
      const promptFromServer = typeof data?.settings?.systemPrompt === "string" ? data.settings.systemPrompt.trim() : "";
      setChatSystemPrompt(promptFromServer || DEFAULT_SYSTEM_PROMPT);
      setSuccessMessage("챗봇 설정이 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("챗봇 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const addMediaLink = () => {
    if (!newMediaUrl.trim()) return;
    setEditMedia((prev) => [...prev, { kind: newMediaKind, url: newMediaUrl.trim() }]);
    setNewMediaUrl("");
  };

  const addMediaFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("파일 크기는 5MB 이하로 업로드해주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
        setEditMedia((prev) => [...prev, { kind, url: result, name: file.name }]);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeMediaAt = (idx: number) => {
    setEditMedia((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!selectedFaq?.id) return;
    setSaveLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = { title: editTitle, content: editContent, category: editCategory, media: editMedia };
      const { data } = await axios.put(`${apiBase}/api/faq/${selectedFaq.id}`, payload);
      setFaqs((prev) => prev.map((f) => (f.id === data.id ? data : f)));
      selectFaq(data);
      setSuccessMessage("FAQ가 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("FAQ 저장 중 오류가 발생했습니다.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCreate = async () => {
    setSaveLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = { title: editTitle, content: editContent, category: editCategory, media: editMedia };
      const { data } = await axios.post(`${apiBase}/api/faq/create`, payload);
      setFaqs((prev) => [data, ...prev]);
      selectFaq(data);
      setIsCreating(false);
      setSuccessMessage("FAQ가 추가되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("FAQ 생성 중 오류가 발생했습니다.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFaq?.id) return;
    setDeleteLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await axios.delete(`${apiBase}/api/faq/${selectedFaq.id}`);
      setFaqs((prev) => prev.filter((f) => f.id !== selectedFaq.id));
      clearSelection();
      setSuccessMessage("삭제되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleteLoading(false);
      setShowConfirmDelete(false);
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setDeleteLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await axios.post(`${apiBase}/api/faq/delete-bulk`, { ids });
      setFaqs((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      if (selectedFaq && selectedIds.has(selectedFaq.id)) {
        clearSelection();
      } else {
        setSelectedIds(new Set());
      }
      setSuccessMessage("선택한 FAQ가 삭제되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("선택 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleInlineCategorySave = async (item: FAQItem) => {
    const newCat = editingCategories[item.id];
    if (newCat === undefined || newCat === item.category) return;
    try {
      const payload = { category: newCat };
      const { data } = await axios.put(`${apiBase}/api/faq/${item.id}`, payload);
      setFaqs((prev) => prev.map((f) => (f.id === data.id ? data : f)));
      if (selectedFaq?.id === item.id) {
        selectFaq(data);
      }
      setSuccessMessage("카테고리가 수정되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("카테고리 수정 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      handleFetch();
    }, 300);
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, categoryFilter]);

  useEffect(() => {
    fetchCategories();
    handleFetch();
    loadChatSettings();
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: ui.bg, color: ui.text }}>
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="rounded-3xl border px-6 py-6 shadow-md" style={{ borderColor: ui.border, backgroundColor: ui.panel }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest" style={{ color: ui.muted }}>Admin Console</p>
              <h1 className="text-3xl font-semibold" style={{ color: ui.text }}>CS 단일 문서 운영</h1>
              <p className="text-sm" style={{ color: ui.muted }}>챗봇(/chatbot)과 FAQ(/docs)를 한 곳에서 관리합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: ui.accentSoft, color: ui.text, border: `1px solid ${ui.border}` }}>
                FAQ 총 {lastTotalCount ?? faqs.length ?? 0}건
              </span>
            </div>
          </div>
        </header>

        {successMessage && (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#6EE7B7", backgroundColor: "#ECFDF3", color: "#065F46" }}>
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#FCA5A5", backgroundColor: "#FEF2F2", color: "#991B1B" }}>
            {errorMessage}
          </div>
        )}

        <div className="space-y-6">
          {/* Chat header / thumbnail settings */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold" style={{ color: ui.text }}>챗봇 헤더/썸네일</h2>
                  {settingsLoading && (
                    <span className="text-xs" style={{ color: ui.muted }}>
                      불러오는 중...
                    </span>
                  )}
                </div>
                <label className="flex flex-col gap-2 text-sm" style={{ color: ui.text }}>
                  헤더 텍스트
                  <input
                    value={chatHeaderText}
                    onChange={(e) => setChatHeaderText(e.target.value)}
                    type="text"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                    placeholder="예: 당특순에게 모두 물어보세요!"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm" style={{ color: ui.text }}>
                  썸네일 이미지 URL
                  <input
                    value={chatThumbnailUrl}
                    onChange={(e) => setChatThumbnailUrl(e.target.value)}
                    type="text"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                    placeholder="https://example.com/thumbnail.png"
                  />
                </label>
                <div className="flex flex-col gap-2 text-sm" style={{ color: ui.text }}>
                  업로드로 교체하기
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1_500_000) {
                        setErrorMessage("이미지 크기는 1.5MB 이하로 업로드해주세요.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result;
                        if (typeof result === "string") {
                          setChatThumbnailDataUrl(result);
                          setThumbnailFileName(file.name);
                          setChatThumbnailUrl(""); // URL 입력은 지움
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <p className="text-xs" style={{ color: ui.muted }}>
                    파일 업로드 시 데이터로 저장되어 서버 재시작 후에도 유지됩니다. (최대 1.5MB)
                  </p>
                  {thumbnailFileName && (
                    <p className="text-xs" style={{ color: ui.text }}>
                      선택됨: {thumbnailFileName}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: "#E5E7EB", color: ui.text, border: `1px solid ${ui.border}` }}
                      onClick={() => {
                        setChatThumbnailDataUrl("");
                        setThumbnailFileName("");
                      }}
                    >
                      업로드 취소
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: "#E5E7EB", color: ui.text, border: `1px solid ${ui.border}` }}
                      onClick={() => {
                        setChatThumbnailUrl("");
                        setChatThumbnailDataUrl("");
                        setThumbnailFileName("");
                      }}
                    >
                      기본 이미지로
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm" style={{ color: ui.text }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">챗봇 말투/시스템 프롬프트</p>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1 text-[11px] font-semibold"
                      style={{ backgroundColor: "#E5E7EB", color: ui.text, border: `1px solid ${ui.border}` }}
                      onClick={() => setChatSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                    >
                      기본 템플릿 적용
                    </button>
                  </div>
                  <textarea
                    value={chatSystemPrompt}
                    onChange={(e) => setChatSystemPrompt(e.target.value)}
                    rows={10}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text, lineHeight: "1.5" }}
                    placeholder="챗봇 페르소나, 말투, 응답 규칙을 작성하세요. {{FAQ_LINK}}, {{SUPPORT_LINK}} 변수는 자동 치환됩니다."
                  />
                  <p className="text-xs" style={{ color: ui.muted }}>
                    관리자 입력이 LLM 시스템 프롬프트로 바로 전달됩니다. FAQ 링크({"{FAQ_LINK}"})와 문의 링크({"{SUPPORT_LINK}"}) 플레이스홀더는 자동으로 실제 URL로 교체됩니다.
                  </p>
                </div>
                <p className="text-xs" style={{ color: ui.muted }}>
                  /chatbot 랜딩 헤더와 썸네일에 반영됩니다. 이미지가 깨지면 기본 이미지로 대체됩니다.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={settingsSaving}
                    onClick={handleSaveChatSettings}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: ui.accent, color: "#fff", border: `1px solid ${ui.border}` }}
                  >
                    {settingsSaving && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-t-white" />
                    )}
                    저장
                  </button>
                  <button
                    disabled={settingsLoading}
                    onClick={loadChatSettings}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: ui.accentSoft, color: ui.text, border: `1px solid ${ui.border}` }}
                  >
                    새로고침
                  </button>
                </div>
              </div>
              <div
                className="flex w-full max-w-[220px] flex-col items-center gap-2 rounded-xl border p-3 text-center"
                style={{ borderColor: ui.border, backgroundColor: "#fff" }}
              >
                <div
                  className="relative h-28 w-28 overflow-hidden rounded-full border"
                  style={{ borderColor: ui.border, backgroundColor: ui.panel }}
                >
                  <img
                    src={chatThumbnailDataUrl || chatThumbnailUrl || "/capychat_mascot.png"}
                    alt="썸네일 미리보기"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/capychat_mascot.png";
                    }}
                  />
                </div>
                <p className="text-sm font-semibold" style={{ color: ui.text, wordBreak: "keep-all" }}>
                  {chatHeaderText || "헤더 텍스트"}
                </p>
                <p className="text-[11px]" style={{ color: ui.muted }}>
                  챗봇 랜딩 미리보기
                </p>
              </div>
            </div>
          </div>

          {/* Info badges */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: ui.muted }}>FAQ 총량</p>
              <p className="text-2xl font-semibold">{lastTotalCount ?? faqs.length ?? 0}건</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: ui.muted }}>최근 생성</p>
              <p className="text-sm" style={{ color: ui.text }}>신규 {lastAddedCount ?? 0}건 · 미반영 {lastSkippedCount ?? 0}건</p>
              <p className="text-xs" style={{ color: ui.muted }}>{lastRunAt ? `최근 실행: ${lastRunAt}` : "실행 기록 없음"}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: ui.muted }}>챗봇 질문</p>
              <p className="text-2xl font-semibold">{analytics.chat}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: ui.muted }}>FAQ 클릭</p>
              <p className="text-2xl font-semibold">{analytics.faq}</p>
            </div>
          </div>

          {analytics.topFaqs.length > 0 && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
              <h3 className="text-sm font-semibold" style={{ color: ui.text }}>자주 클릭된 FAQ Top 5</h3>
              <ul className="mt-2 space-y-1 text-sm" style={{ color: ui.text }}>
                {analytics.topFaqs.map((f, idx) => (
                  <li key={`${f.faqId}-${idx}`} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{idx + 1}.</span>
                    <span className="flex-1">{f.faqTitle || `FAQ #${f.faqId ?? "-"}`}</span>
                    <span className="text-xs text-slate-600">{f.count}회</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Input */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
            <h2 className="text-lg font-semibold" style={{ color: ui.text }}>상담 로그 입력</h2>
            <div className="mt-4 space-y-3">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                placeholder={"Q1: 배송 언제 오나요?\nA1: 보통 1~3일 소요됩니다.\nQ2: 결제 영수증 발급?\nA2: 마이페이지 > 주문내역에서 다운로드 가능합니다."}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: ui.muted }}>카테고리는 자동 분류됩니다.</span>
                <button
                  disabled={loading}
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-md transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: ui.accent, color: "#fff", border: `1px solid ${ui.border}` }}
                >
                  {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-white" />}
                  FAQ로 정리하기
                </button>
              </div>
              {generationNote && (
                <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#FBBF24", backgroundColor: "#FEFCE8", color: ui.text }}>
                  {generationNote}
                </div>
              )}
            </div>
          </div>

          {/* List + detail */}
          <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  type="search"
                  placeholder="검색어 입력"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                >
                  <option value="">전체</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  disabled={refreshing}
                  onClick={() => handleFetch()}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: ui.accentSoft, color: ui.text, border: `1px solid ${ui.border}` }}
                >
                  {refreshing && <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-t-white" />}
                  검색/새로고침
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={startCreate}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
                  style={{ backgroundColor: "#DEF7EC", color: "#065F46", border: "1px solid #6EE7B7" }}
                >
                  새 FAQ 추가
                </button>
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: ui.border }}>
                  <button
                    className={`px-3 py-1 text-xs ${viewMode === "category" ? "font-semibold" : ""}`}
                    style={{ backgroundColor: viewMode === "category" ? ui.accent : "#fff", color: viewMode === "category" ? "#fff" : ui.text }}
                    onClick={() => setViewMode("category")}
                  >
                    카테고리 뷰
                  </button>
                  <button
                    className={`px-3 py-1 text-xs ${viewMode === "table" ? "font-semibold" : ""}`}
                    style={{ backgroundColor: viewMode === "table" ? ui.accent : "#fff", color: viewMode === "table" ? "#fff" : ui.text }}
                    onClick={() => setViewMode("table")}
                  >
                    테이블
                  </button>
                </div>
                <button
                  disabled={!selectedIds.size || deleteLoading}
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}
                >
                  {deleteLoading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />}
                  선택 삭제 ({selectedIds.size})
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {viewMode === "table" ? (
                  <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${ui.border}` }}>
                    {faqs.length ? (
                      <table className="min-w-full divide-y" style={{ color: ui.text, borderColor: ui.border }}>
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-widest" style={{ color: ui.muted }}>
                            <th className="px-3 py-2">카테고리</th>
                            <th className="px-3 py-2">질문</th>
                            <th className="px-3 py-2">답변 요약</th>
                            <th className="px-3 py-2">신뢰도</th>
                            <th className="px-3 py-2">출처</th>
                            <th className="px-3 py-2">선택</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-sm" style={{ borderColor: ui.border }}>
                          {faqs.map((item) => (
                            <tr
                              key={item.id}
                              className={`cursor-pointer ${selectedFaq?.id === item.id ? "bg-orange-50" : "hover:bg-orange-50/60"}`}
                              onClick={() => selectFaq(item)}
                            >
                              <td className="px-3 py-2">
                                <select
                                  className="rounded px-2 py-1 text-xs"
                                  style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                                  value={editingCategories[item.id] ?? item.category ?? ""}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setEditingCategories((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  onBlur={() => handleInlineCategorySave(item)}
                                >
                                  <option value="">미지정</option>
                                  {categoryOptions.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 font-semibold">{item.title}</td>
                              <td className="px-3 py-2">{snippet(item.content)}</td>
                              <td className="px-3 py-2">
                                {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : <span className="text-slate-500">-</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{item.sourceType ?? "llm_import"}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(item.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => toggleSelectId(item.id)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed px-4 py-6 text-sm" style={{ borderColor: ui.border, color: ui.muted }}>
                        <p className="font-semibold" style={{ color: ui.text }}>아직 FAQ가 없습니다.</p>
                        <p>상담 로그를 붙여넣고 “FAQ로 정리하기”를 눌러보세요.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedFaqs.length ? (
                      groupedFaqs.map(([cat, items]) => (
                        <div key={cat} className="rounded-2xl p-4" style={{ backgroundColor: ui.panel, border: `1px solid ${ui.border}` }}>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm uppercase tracking-widest" style={{ color: ui.text }}>{cat}</h4>
                            <span className="text-xs" style={{ color: ui.muted }}>{items.length}건</span>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className={`group cursor-pointer rounded-xl p-3 transition ${selectedFaq?.id === item.id ? "border border-orange-200 bg-orange-50" : "border border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/70"}`}
                                onClick={() => selectFaq(item)}
                              >
                                <div className="flex items-center gap-2 text-xs" style={{ color: ui.muted }}>
                                  <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px]" style={{ backgroundColor: ui.accentSoft, border: `1px solid ${ui.border}`, color: ui.text }}>
                                    {item.sourceType ?? "llm_import"}
                                  </span>
                                  {item.confidence != null && (
                                    <span className="text-emerald-600">{Math.round(item.confidence * 100)}%</span>
                                  )}
                                  <span className="ml-auto text-[11px] flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(item.id)}
                                      onChange={() => toggleSelectId(item.id)}
                                    />
                                    선택
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <h5 className="text-sm font-semibold flex-1" style={{ color: ui.text }}>{item.title}</h5>
                                  <select
                                    className="rounded px-2 py-1 text-[11px]"
                                    style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                                    value={editingCategories[item.id] ?? item.category ?? ""}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditingCategories((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    onBlur={() => handleInlineCategorySave(item)}
                                  >
                                    <option value="">미지정</option>
                                    {categoryOptions.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed" style={{ color: ui.text }}>{snippet(item.content)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed px-4 py-6 text-sm" style={{ borderColor: ui.border, color: ui.muted }}>
                        <p className="font-semibold" style={{ color: ui.text }}>아직 FAQ가 없습니다.</p>
                        <p>상담 로그를 붙여넣고 “FAQ로 정리하기”를 눌러보세요.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl p-4" style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}` }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm uppercase tracking-widest" style={{ color: ui.muted }}>디테일 패널</h3>
                  {(selectedFaq || isCreating) && (
                    <button className="text-xs" style={{ color: ui.muted }} onClick={clearSelection}>
                      선택 해제
                    </button>
                  )}
                </div>
                {selectedFaq || isCreating ? (
                  <div className="space-y-3">
                    <label className="flex flex-col gap-2 text-sm" style={{ color: ui.text }}>
                      질문(제목)
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        type="text"
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm" style={{ color: ui.text }}>
                      답변
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm" style={{ color: ui.text }}>
                      카테고리
                      <input
                        value={editCategory ?? ""}
                        onChange={(e) => setEditCategory(e.target.value)}
                        type="text"
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                        placeholder="예: 배송"
                      />
                    </label>
                    <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: ui.border, backgroundColor: ui.panel }}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold" style={{ color: ui.text }}>첨부 미디어</p>
                        <span className="text-xs" style={{ color: ui.muted }}>{editMedia.length}개</span>
                      </div>
                      <div className="space-y-2">
                        {editMedia.length ? (
                          editMedia.map((m, idx) => (
                            <div key={`${m.url}-${idx}`} className="flex items-center gap-2 rounded-md border px-2 py-2" style={{ borderColor: ui.border, backgroundColor: "#fff" }}>
                              <div className="h-10 w-10 overflow-hidden rounded bg-slate-100 flex items-center justify-center">
                                {m.kind === "video" ? (
                                  <video className="h-full w-full object-cover" src={m.url} />
                                ) : (
                                  <img className="h-full w-full object-cover" src={m.url} alt={m.name || "image"} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold" style={{ color: ui.text }}>
                                  {m.name || m.url.slice(0, 40)}
                                </p>
                                <p className="text-[11px]" style={{ color: ui.muted }}>{m.kind === "video" ? "동영상" : "이미지"}</p>
                              </div>
                              <button
                                type="button"
                                className="text-xs rounded px-2 py-1"
                                style={{ color: "#991B1B", backgroundColor: "#FEE2E2", border: "1px solid #FCA5A5" }}
                                onClick={() => removeMediaAt(idx)}
                              >
                                제거
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs" style={{ color: ui.muted }}>첨부된 이미지/동영상이 없습니다.</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={newMediaKind}
                            onChange={(e) => setNewMediaKind(e.target.value as "image" | "video")}
                            className="rounded px-2 py-1 text-xs"
                            style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                          >
                            <option value="image">이미지</option>
                            <option value="video">동영상</option>
                          </select>
                          <input
                            value={newMediaUrl}
                            onChange={(e) => setNewMediaUrl(e.target.value)}
                            type="text"
                            className="flex-1 rounded px-2 py-1 text-sm outline-none min-w-[160px]"
                            style={{ backgroundColor: "#fff", border: `1px solid ${ui.border}`, color: ui.text }}
                            placeholder="https://example.com/media.png"
                          />
                          <button
                            type="button"
                            className="rounded px-3 py-1 text-xs font-semibold"
                            style={{ backgroundColor: ui.accentSoft, color: ui.text, border: `1px solid ${ui.border}` }}
                            onClick={addMediaLink}
                          >
                            링크 추가
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: ui.muted }}>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) addMediaFile(file);
                              e.target.value = "";
                            }}
                          />
                          <span>업로드 시 Base64로 저장됩니다. (5MB 이하 권장)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        disabled={saveLoading}
                        onClick={isCreating ? handleCreate : handleSave}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: ui.accent, color: "#fff", border: `1px solid ${ui.border}` }}
                      >
                        {saveLoading && (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-t-white" />
                        )}
                        {isCreating ? "신규 등록" : "저장"}
                      </button>
                      {!isCreating && (
                        <button
                          disabled={deleteLoading}
                          onClick={() => setShowConfirmDelete(true)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ backgroundColor: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}
                        >
                          {deleteLoading && (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-200 border-t-transparent" />
                          )}
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: ui.muted }}>테이블에서 항목을 클릭하면 이곳에서 수정/삭제할 수 있습니다.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showConfirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl shadow-black/40">
              <h3 className="text-lg font-semibold">삭제하시겠습니까?</h3>
              <p className="text-sm text-slate-300">
                "{selectedFaq?.title}" 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400"
                  onClick={() => setShowConfirmDelete(false)}
                >
                  취소
                </button>
                <button
                  disabled={deleteLoading}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteLoading && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  )}
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
