"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SYSTEM_PROMPT } from "../../lib/chatbotPrompt";
import { Edit3, Trash2, Plus, RefreshCw, Save, X, Search, MessageSquare, FileText, BarChart3, Settings, LogOut, Code2 } from "lucide-react";

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

type AnalyticsSummary = {
  chat: number;
  faq: number;
  topFaqs: { faqId: number | null; faqTitle: string | null; count: number }[];
  topFaqs30d: { faqId: number | null; faqTitle: string | null; count: number }[];
  topQuestions: { message: string; count: number }[];
  chatTrends: {
    daily: { bucket: string | Date; count: number }[];
    weekly: { bucket: string | Date; count: number }[];
    monthly: { bucket: string | Date; count: number }[];
  };
};

type MeResponse = {
  user: {
    tenantKey: string;
    tenantName: string;
  };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
const snippet = (text: string, max = 80) => (text && text.length > max ? `${text.slice(0, max - 3)}...` : text);

// New UI Palette matching /docs page (Ivory/Earth Tone)
const ui = {
  bg: "#F0F0EB",
  panel: "#FAFAF7",
  card: "#FFFFFF",
  border: "#E5E4DF",
  accent: "#CC785C", // Terra Cotta
  accentHover: "#B3654A",
  accentSoft: "#EBD8BC", // Manilla
  accentLight: "#F5EAD9",
  text: "#3B3A37",
  subtext: "#6B665C",
  success: "#059669",     // Emerald 600
  successBg: "#ECFDF5",   // Emerald 50
  danger: "#DC2626",      // Red 600
  dangerBg: "#FEF2F2",    // Red 50
  inputBg: "#FFFFFF",
};

export default function AdminClient({ initialOrigin }: { initialOrigin: string }) {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<"analytics" | "faq" | "chatbot" | "install">("analytics");
  const [tenantInfo, setTenantInfo] = useState<{ key: string; name: string } | null>(null);
  const [publicOrigin, setPublicOrigin] = useState(initialOrigin || "");
  const [installCopied, setInstallCopied] = useState(false);


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
  const [viewMode, setViewMode] = useState<"table" | "category">("table");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingCategories, setEditingCategories] = useState<Record<number, string>>({});
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [generationNote, setGenerationNote] = useState("");

  // Chatbot settings
  const [chatHeaderText, setChatHeaderText] = useState("");
  const [chatThumbnailUrl, setChatThumbnailUrl] = useState("");
  const [chatThumbnailDataUrl, setChatThumbnailDataUrl] = useState("");
  const [chatSystemPrompt, setChatSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [thumbnailFileName, setThumbnailFileName] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Media add state
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaKind, setNewMediaKind] = useState<"image" | "video">("image");

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    chat: 0,
    faq: 0,
    topFaqs: [],
    topFaqs30d: [],
    topQuestions: [],
    chatTrends: { daily: [], weekly: [], monthly: [] },
  });
  const [logoutLoading, setLogoutLoading] = useState(false);

  const categoryOptions = useMemo(() => {
    const fromDb = categories.map((c) => c.name);
    const fromFaqs = faqs
      .map((f) => f.category)
      .filter((c): c is string => !!c);
    return Array.from(new Set([...fromDb, ...fromFaqs])).sort();
  }, [categories, faqs]);
  const groupedFaqs = useMemo(() => {
    const groups: Record<string, FAQItem[]> = {};
    faqs.forEach((f) => {
      const key = f.category || "미지정";
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [faqs]);

  // Consistent badge colors
  const getBadgeColor = (category: string) => {
    const styles = [
      { bg: "#E8D5C4", text: "#5C4033", border: "#D4C0AF" },
      { bg: "#D4E0D9", text: "#2F4F4F", border: "#BFD0C4" },
      { bg: "#D1D9E6", text: "#36454F", border: "#BCC6D6" },
      { bg: "#E6D1D1", text: "#5C3333", border: "#D6BDBD" },
      { bg: "#E0D4E6", text: "#4B365F", border: "#CDBDD6" },
      { bg: "#D9D2C5", text: "#4A4036", border: "#C4BCAD" },
      { bg: "#CBD6D6", text: "#3A4A4A", border: "#B6C4C4" },
    ];
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % styles.length;
    return styles[idx];
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.replace("/login");
    } catch (err) {
      console.error(err);
      setErrorMessage("로그아웃 실패");
    } finally {
      setLogoutLoading(false);
    }
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

  const selectFaq = (item: FAQItem) => {
    setSelectedFaq(item);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditCategory(item.category ?? "");
    setEditMedia(parseMedia(item.media));
    setIsCreating(false);
    setSuccessMessage("");
    setEditingCategories((prev) => ({ ...prev, [item.id]: item.category ?? "" }));
    // scroll to top of editor if needed?
  };

  const toggleSelectFaq = (item: FAQItem) => {
    if (selectedFaq?.id === item.id) {
      clearSelection();
    } else {
      selectFaq(item);
    }
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
        setGenerationNote("신규 0건입니다. 텍스트 형식/LLM 신뢰도 필터 설정 확인 필요");
      } else {
        setGenerationNote("");
      }
      await Promise.all([handleFetch(), fetchCategories()]);
      if (items[0]) selectFaq(items[0]);
      setSuccessMessage(
        `FAQ 정리 완료! 신규 ${added}건 추가됨 (중복 ${skipped}건 제외)`
      );
    } catch (err) {
      console.error(err);
      setErrorMessage("FAQ 생성 요청 실패. API 키나 서버 로그를 확인하세요.");
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
      setErrorMessage("FAQ 목록 로드 실패");
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
      setErrorMessage("카테고리 목록 로드 실패");
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { data } = await axios.get(`${apiBase}/api/analytics/summary`);
      setAnalytics({
        chat: data?.chatCount ?? 0,
        faq: data?.faqClickCount ?? 0,
        topFaqs: data?.topFaqs ?? [],
        topFaqs30d: data?.topFaqs30d ?? [],
        topQuestions: data?.topQuestions ?? [],
        chatTrends: data?.chatTrends ?? { daily: [], weekly: [], monthly: [] },
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
      setErrorMessage("챗봇 설정 로드 실패");
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
      setSuccessMessage("설정이 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("설정 저장 실패");
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
      setSuccessMessage("저장되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("저장 실패");
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
      setSuccessMessage("추가되었습니다.");
    } catch (err) {
      console.error(err);
      setErrorMessage("추가 실패");
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
      setErrorMessage("삭제 실패");
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

  const toggleSelectAll = () => {
    if (selectedIds.size === faqs.length && faqs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(faqs.map((f) => f.id)));
    }
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
      setSuccessMessage(`${ids.length}건 삭제 완료`);
    } catch (err) {
      console.error(err);
      setErrorMessage("일괄 삭제 실패");
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
      setSuccessMessage("카테고리 수정됨");
    } catch (err) {
      console.error(err);
      setErrorMessage("카테고리 수정 실패");
    }
  };

  useEffect(() => {
    axios.defaults.withCredentials = true;
  }, []);

  useEffect(() => {
    try {
      setPublicOrigin(window.location.origin);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let canceled = false;
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) throw new Error("unauthorized");
        const data = (await res.json().catch(() => null)) as MeResponse | null;
        if (!canceled && data?.user?.tenantKey) {
          setTenantInfo({ key: data.user.tenantKey, name: data.user.tenantName });
        }
        if (!canceled) setAuthorized(true);
      } catch {
        if (!canceled) router.replace("/login");
      } finally {
        if (!canceled) setAuthLoading(false);
      }
    };
    checkAuth();
    return () => {
      canceled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    const delay = setTimeout(() => {
      handleFetch();
    }, 300);
    return () => clearTimeout(delay);
  }, [authorized, searchQuery, categoryFilter]);

  useEffect(() => {
    if (!authorized) return;
    fetchCategories();
    handleFetch();
    loadChatSettings();
    fetchAnalytics();
  }, [authorized]);

  // UI Components
  const renderTrendList = (rows: { bucket: string | Date; count: number }[]) => {
    if (!rows?.length) return <div className="text-xs text-gray-400">데이터 없음</div>;
    return rows.slice(-8).map((row, idx) => (
      <div key={idx} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm border-b last:border-0" style={{ borderColor: ui.border }}>
        <span>{new Date(row.bucket).toLocaleDateString()}</span>
        <span className="font-semibold">{row.count}</span>
      </div>
    ));
  };

  const EditorBlock = ({ mode }: { mode: "edit" | "create" }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: ui.subtext }}>질문(Title)</label>
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-opacity-20"
          style={{ backgroundColor: ui.inputBg, border: `1px solid ${ui.border}`, color: ui.text }}
          placeholder="질문을 입력하세요"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: ui.subtext }}>답변(Content)</label>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={6}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-opacity-20 leading-relaxed"
          style={{ backgroundColor: ui.inputBg, border: `1px solid ${ui.border}`, color: ui.text }}
          placeholder="답변 내용을 작성하세요"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: ui.subtext }}>카테고리</label>
        <input
          value={editCategory ?? ""}
          onChange={(e) => setEditCategory(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{ backgroundColor: ui.inputBg, border: `1px solid ${ui.border}`, color: ui.text }}
          placeholder="예: 배송, 환불"
        />
      </div>

      {/* Media Attachments */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: ui.border, backgroundColor: ui.bg }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: ui.subtext }}>첨부 미디어 ({editMedia.length})</span>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-white border" style={{ borderColor: ui.border, color: ui.subtext }}>
              <Plus size={12} /> 파일 업로드
              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addMediaFile(file);
                e.target.value = "";
              }} />
            </label>
          </div>
        </div>

        {editMedia.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {editMedia.map((m, idx) => (
              <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border bg-gray-100" style={{ borderColor: ui.border }}>
                {m.kind === 'video' ? (
                  <video src={m.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.url} alt="preview" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removeMediaAt(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newMediaUrl}
            onChange={(e) => setNewMediaUrl(e.target.value)}
            placeholder="또는 이미지 URL 입력"
            className="flex-1 rounded-md px-2 py-1 text-xs border outline-none"
            style={{ borderColor: ui.border }}
          />
          <button onClick={addMediaLink} className="text-xs px-3 py-1 rounded-md font-medium border bg-white" style={{ borderColor: ui.border }}>추가</button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={mode === "create" ? handleCreate : handleSave}
          disabled={saveLoading}
          className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 flex justify-center items-center gap-2"
          style={{ backgroundColor: ui.accent }}
        >
          {saveLoading && <RefreshCw size={14} className="animate-spin" />}
          {mode === "create" ? "작성 완료" : "변경사항 저장"}
        </button>

        {mode === "create" ? (
          <button onClick={clearSelection} className="px-4 py-2.5 rounded-lg text-sm font-medium border bg-white" style={{ borderColor: ui.border, color: ui.subtext }}>
            취소
          </button>
        ) : (
          <button
            onClick={() => setShowConfirmDelete(true)}
            disabled={deleteLoading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium border bg-white text-red-600 hover:bg-red-50"
            style={{ borderColor: ui.border }}
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: ui.bg, color: ui.text }}>
        {authLoading ? "접속 권한을 확인하는 중입니다..." : "로그인 페이지로 이동합니다..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: ui.bg, color: ui.text }}>
      <div className="mx-auto max-w-6xl px-6 space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ui.subtext }}>
              Admin Console
            </p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: ui.text }}>
              운영 관리 허브
            </h1>
            <p className="text-sm max-w-lg leading-relaxed" style={{ color: ui.subtext }}>
              챗봇 데이터와 FAQ 문서를 한곳에서 관리하세요. LLM이 상담 로그를 분석하여 자동으로 FAQ를 생성해줍니다.
            </p>
            {tenantInfo && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold shadow-sm" style={{ borderColor: ui.border, color: ui.subtext }}>
                  <span>현재 채널</span>
                  <span style={{ color: ui.text }}>{tenantInfo.name}</span>
                  <span className="opacity-60">(설치 코드:</span>
                  <span className="font-mono" style={{ color: ui.text }}>{tenantInfo.key}</span>
                  <span className="opacity-60">)</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs shadow-sm" style={{ borderColor: ui.border, color: ui.subtext }}>
                  <span>임베드:</span>
                  <code className="font-mono" style={{ color: ui.text }}>/chatbot?code={tenantInfo.key}</code>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <div className="px-4 py-2 rounded-full border bg-white text-xs font-semibold shadow-sm" style={{ borderColor: ui.border, color: ui.subtext }}>
              전체 FAQ <span style={{ color: ui.accent }}>{lastTotalCount ?? faqs.length}</span>
            </div>
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border bg-white shadow-sm disabled:opacity-60"
              style={{ borderColor: ui.border, color: ui.text }}
            >
              {logoutLoading ? <RefreshCw size={14} className="animate-spin" /> : <LogOut size={14} />}
              로그아웃
            </button>
          </div>
        </header>

        {/* Global Messages */}
        {successMessage && (
          <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2" style={{ borderColor: "#A7F3D0", backgroundColor: ui.successBg, color: ui.success }}>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2" style={{ borderColor: "#FECACA", backgroundColor: ui.dangerBg, color: ui.danger }}>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {errorMessage}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b" style={{ borderColor: ui.border }}>
          <nav className="flex gap-6">
            {[
              { id: "analytics", label: "데이터 분석", icon: BarChart3 },
              { id: "faq", label: "FAQ 관리", icon: FileText },
              { id: "chatbot", label: "챗봇 설정", icon: Settings },
              { id: "install", label: "위젯 설치", icon: Code2 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id ? "border-current" : "border-transparent opacity-50 hover:opacity-100"}`}
                style={{ color: activeTab === tab.id ? ui.accent : ui.text }}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "FAQ 총량", val: lastTotalCount ?? faqs.length },
                  { label: "챗봇 질문 수", val: analytics.chat },
                  { label: "FAQ 클릭 수", val: analytics.faq },
                  { label: "최근 생성", val: `+${lastAddedCount ?? 0}` }
                ].map((stat, i) => (
                  <div key={i} className="rounded-2xl p-5 border shadow-sm bg-white" style={{ borderColor: ui.border }}>
                    <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: ui.subtext }}>{stat.label}</p>
                    <p className="text-3xl font-bold" style={{ color: ui.text }}>{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-2xl p-6 border bg-white shadow-sm" style={{ borderColor: ui.border }}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: ui.text }}>
                    <MessageSquare size={16} /> 최근 많이 묻는 질문
                  </h3>
                  <div className="space-y-3">
                    {analytics.topQuestions.length === 0 ? <p className="text-sm text-gray-400">데이터가 없습니다.</p> :
                      analytics.topQuestions.map((q, i) => (
                        <div key={i} className="flex justify-between items-center text-sm p-3 rounded-lg bg-gray-50">
                          <span>{q.message}</span>
                          <span className="font-bold text-xs bg-white px-2 py-1 rounded border shadow-sm">{q.count}회</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="rounded-2xl p-6 border bg-white shadow-sm" style={{ borderColor: ui.border }}>
                  <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: ui.text }}>
                    <BarChart3 size={16} /> 카테고리별/월별 추세
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: ui.subtext }}>월간 챗봇 이용 추이</p>
                      {renderTrendList(analytics.chatTrends.monthly)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ TAB */}
          {activeTab === "faq" && (
            <div className="grid lg:grid-cols-[380px_1fr] gap-8 items-start">

              {/* Left: Generator & Editor */}
              <div className="space-y-6 sticky top-6">
                <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: ui.border }}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: ui.text }}>
                    <Save size={16} /> 상담 로그로 자동 생성
                  </h3>
                  <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    className="w-full h-32 text-sm p-3 rounded-xl border outline-none resize-none mb-3"
                    style={{ backgroundColor: ui.bg, borderColor: ui.border }}
                    placeholder={`고객과의 상담 내용을 여기에 붙여넣으세요.\nLLM이 자동으로 Q&A를 추출합니다.`}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 flex justify-center items-center gap-2"
                    style={{ backgroundColor: ui.accent }}
                  >
                    {loading ? <RefreshCw className="animate-spin" size={16} /> : "FAQ 추출 및 생성하기"}
                  </button>
                </div>

                {/* Editor Panel (Only show if creating or editing) */}
                {(isCreating || selectedFaq) && (
                  <div className="rounded-2xl border bg-white p-5 shadow-sm animate-in fade-in slide-in-from-left-4" style={{ borderColor: ui.border }}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold flex items-center gap-2" style={{ color: ui.text }}>
                        <Edit3 size={16} /> {isCreating ? "새 FAQ 작성" : "FAQ 수정"}
                      </h3>
                      <button onClick={clearSelection} className="text-xs hover:underline" style={{ color: ui.subtext }}>닫기</button>
                    </div>
                    <EditorBlock mode={isCreating ? "create" : "edit"} />
                  </div>
                )}
              </div>

              {/* Right: List */}
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="FAQ 검색..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-opacity-20 bg-white"
                      style={{ borderColor: ui.border, color: ui.text }}
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border outline-none bg-white text-sm"
                    style={{ borderColor: ui.border, color: ui.text }}
                  >
                    <option value="">전체 카테고리</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={startCreate}
                    className="px-4 py-2.5 rounded-xl border bg-white text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
                    style={{ borderColor: ui.border, color: ui.text }}
                  >
                    <Plus size={16} /> 직접 추가
                  </button>

                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={deleteLoading}
                      className="px-4 py-2.5 rounded-xl border bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 flex items-center gap-2 ml-auto"
                      style={{ borderColor: "transparent" }}
                    >
                      <Trash2 size={16} /> {selectedIds.size}건 삭제
                    </button>
                  )}
                </div>

                {/* List Content */}
                <div className="rounded-2xl border bg-white overflow-hidden shadow-sm" style={{ borderColor: ui.border }}>
                  {viewMode === "table" ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 border-b" style={{ borderColor: ui.border }}>
                          <tr style={{ color: ui.subtext }}>
                            <th className="px-6 py-3 font-semibold w-12 text-center">
                              <input
                                type="checkbox"
                                className="accent-gray-500 rounded"
                                checked={faqs.length > 0 && selectedIds.size === faqs.length}
                                onChange={toggleSelectAll}
                                disabled={faqs.length === 0}
                              />
                            </th>
                            <th className="px-4 py-3 font-semibold w-40">카테고리</th>
                            <th className="px-4 py-3 font-semibold">제목</th>
                            <th className="px-4 py-3 font-semibold w-48">내용 미리보기</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: ui.border }}>
                          {faqs.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
                          ) : faqs.map(item => {
                            const badgeStyle = getBadgeColor(item.category || "기타");
                            const isSelected = selectedIds.has(item.id);
                            const isActive = selectedFaq?.id === item.id;
                            return (
                              <tr
                                key={item.id}
                                onClick={() => selectFaq(item)}
                                className={`group cursor-pointer transition-colors ${isActive ? "bg-amber-50/50" : "hover:bg-gray-50"}`}
                              >
                                <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectId(item.id)}
                                    className="w-4 h-4 rounded border-gray-300 accent-gray-600"
                                  />
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className="inline-flex px-2 py-1 rounded text-xs font-medium border"
                                    style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text, borderColor: badgeStyle.border }}
                                  >
                                    {item.category || "기타"}
                                  </span>
                                </td>
                                <td className="px-4 py-4 font-medium" style={{ color: ui.text }}>{item.title}</td>
                                <td className="px-4 py-4 text-gray-500 truncate max-w-[12rem]">{item.content}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 grid gap-6 md:grid-cols-2">
                      {groupedFaqs.map(([cat, items]) => (
                        <div key={cat} className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: ui.subtext }}>
                            {cat} <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]">{items.length}</span>
                          </h4>
                          <div className="space-y-2">
                            {items.map(item => {
                              const isActive = selectedFaq?.id === item.id;
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => selectFaq(item)}
                                  className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${isActive ? "ring-2 ring-orange-200 border-orange-300 bg-orange-50/30" : "bg-white border-gray-200 hover:border-gray-300"}`}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-sm" style={{ color: ui.text }}>{item.title}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.content}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      {groupedFaqs.length === 0 && <p className="col-span-2 text-center text-gray-400 py-10">데이터가 없습니다.</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CHATBOT SETTINGS TAB */}
          {activeTab === "chatbot" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: ui.border }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: ui.text }}>챗봇 스타일 & 프롬프트</h3>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold" style={{ color: ui.subtext }}>헤더 텍스트</label>
                    <input
                      value={chatHeaderText}
                      onChange={e => setChatHeaderText(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border outline-none bg-gray-50"
                      style={{ borderColor: ui.border }}
                      placeholder="예: 당특순에게 물어보세요"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold" style={{ color: ui.subtext }}>썸네일 이미지</label>

                    <div className="flex gap-4 items-start">
                      {/* Preview */}
                      <div className="shrink-0">
                        <div className="w-20 h-20 rounded-full border overflow-hidden bg-gray-100 relative group" style={{ borderColor: ui.border }}>
                          <img
                            src={chatThumbnailDataUrl || chatThumbnailUrl || "/capychat_mascot.png"}
                            alt="Thumbnail"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "/capychat_mascot.png";
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-center mt-1 text-gray-400">Current</p>
                      </div>

                      <div className="flex-1 space-y-3">
                        <input
                          value={chatThumbnailUrl}
                          onChange={e => setChatThumbnailUrl(e.target.value)}
                          placeholder="이미지 URL 입력..."
                          className="w-full px-4 py-2 rounded-xl border outline-none bg-gray-50 text-sm"
                          style={{ borderColor: ui.border }}
                        />

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">또는</span>
                          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-white text-sm font-medium hover:bg-gray-50" style={{ borderColor: ui.border, color: ui.text }}>
                            <Plus size={14} /> 파일 업로드
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
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
                                    setChatThumbnailUrl("");
                                  }
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>

                          {(chatThumbnailDataUrl || thumbnailFileName) && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-emerald-600 font-medium">{thumbnailFileName || "새 이미지 선택됨"}</span>
                              <button
                                onClick={() => {
                                  setChatThumbnailDataUrl("");
                                  setThumbnailFileName("");
                                }}
                                className="text-[10px] underline text-gray-400 hover:text-red-500"
                              >
                                취소
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold" style={{ color: ui.subtext }}>시스템 프롬프트</label>
                    <textarea
                      value={chatSystemPrompt}
                      onChange={e => setChatSystemPrompt(e.target.value)}
                      rows={12}
                      className="w-full p-4 rounded-xl border outline-none bg-gray-50 text-sm leading-relaxed"
                      style={{ borderColor: ui.border }}
                    />
                    <p className="text-xs text-gray-400">
                      * 변수 {'{FAQ_LINK}'}, {'{SUPPORT_LINK}'} 사용 가능
                    </p>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      onClick={loadChatSettings}
                      disabled={settingsLoading}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium border bg-white"
                      style={{ borderColor: ui.border }}
                    >
                      취소 / 리셋
                    </button>
                    <button
                      onClick={handleSaveChatSettings}
                      disabled={settingsSaving}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md flex items-center gap-2"
                      style={{ backgroundColor: ui.accent }}
                    >
                      {settingsSaving && <RefreshCw size={14} className="animate-spin" />}
                      설정 저장
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* INSTALL TAB */}
          {activeTab === "install" && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: ui.border }}>
                <h3 className="text-lg font-bold mb-2" style={{ color: ui.text }}>웹사이트에 챗봇 위젯 설치</h3>
                <p className="text-sm leading-relaxed" style={{ color: ui.subtext }}>
                  아래 코드를 <span className="font-semibold">그대로 복사</span>해서 웹사이트에 붙여넣으면,
                  채널톡처럼 오른쪽 아래에 챗봇 런처가 뜹니다.
                  <br />
                  런처 아이콘은 <span className="font-semibold">현재 챗봇 썸네일</span>을 자동으로 사용합니다.
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4" style={{ borderColor: ui.border }}>
                <h4 className="font-semibold flex items-center gap-2" style={{ color: ui.text }}>
                  <Code2 size={16} /> 복붙용 설치 코드
                </h4>

                <ol className="list-decimal list-inside text-sm space-y-2" style={{ color: ui.subtext }}>
                  <li>아래 코드를 복사합니다.</li>
                  <li>웹사이트의 <span className="font-semibold">푸터(</span><span className="font-mono">&lt;/body&gt;</span><span className="font-semibold"> 바로 위)</span>에 붙여넣습니다.</li>
                  <li>저장 후 새로고침하면 런처가 나타납니다.</li>
                </ol>

                <div className="rounded-xl border bg-gray-50 p-4 relative" style={{ borderColor: ui.border }}>
                  <button
                    type="button"
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white hover:bg-gray-100"
                    style={{ borderColor: ui.border, color: ui.text }}
                    onClick={async () => {
                      const scriptUrl = (publicOrigin || window.location.origin) + "/capychat-widget.js";
                      const tenant = tenantInfo?.key || "";
                      const code = `<!-- CapyChat 챗봇 위젯 -->\n<script src="${scriptUrl}" data-install-code="${tenant}" async></script>\n<!-- /CapyChat -->`;
                      try {
                        await navigator.clipboard.writeText(code);
                        setInstallCopied(true);
                        setTimeout(() => setInstallCopied(false), 1400);
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    {installCopied ? "복사됨" : "코드 복사"}
                  </button>

                  <pre className="text-xs font-mono whitespace-pre-wrap break-all pr-24" style={{ color: ui.text }}>
{`<!-- CapyChat 챗봇 위젯 -->
<script src="${(publicOrigin || "")}/capychat-widget.js" data-install-code="${tenantInfo?.key || ""}" async></script>
<!-- /CapyChat -->`}
                  </pre>
                </div>

                <div className="text-xs" style={{ color: ui.subtext }}>
                  참고: 웹사이트에 보안 정책(CSP)이 있다면 <span className="font-mono">{publicOrigin || "(현재 도메인)"}</span>에서 스크립트/iframe 로드를 허용해야 할 수 있어요.
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4" style={{ borderColor: ui.border }}>
                <h4 className="font-semibold" style={{ color: ui.text }}>옵션(원할 때만)</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border bg-gray-50 p-4" style={{ borderColor: ui.border }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: ui.text }}>자동으로 열기</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: ui.text }}>{`data-auto-open="1"
data-auto-open-delay="1000"`}</pre>
                  </div>
                  <div className="rounded-xl border bg-gray-50 p-4" style={{ borderColor: ui.border }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: ui.text }}>드래그 이동 끄기</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: ui.text }}>{`data-drag="0"`}</pre>
                  </div>
                  <div className="rounded-xl border bg-gray-50 p-4" style={{ borderColor: ui.border }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: ui.text }}>왼쪽에 배치</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: ui.text }}>{`data-position="left"`}</pre>
                  </div>
                  <div className="rounded-xl border bg-gray-50 p-4" style={{ borderColor: ui.border }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: ui.text }}>JS로 열고/닫기</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: ui.text }}>{`window.CapyChatWidget.open();
window.CapyChatWidget.close();
window.CapyChatWidget.toggle();`}</pre>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-3" style={{ borderColor: ui.border }}>
                <h4 className="font-semibold" style={{ color: ui.text }}>미리보기</h4>
                <p className="text-sm" style={{ color: ui.subtext }}>
                  위젯이 여는 실제 화면은 아래 링크와 동일합니다.
                </p>
                <a
                  href={`/chatbot?code=${encodeURIComponent(tenantInfo?.key || "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-95"
                  style={{ backgroundColor: ui.accent }}
                >
                  챗봇 화면 열기
                </a>
              </div>
            </div>
          )}

        </main>

        {showConfirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95">
              <h3 className="font-bold text-lg text-red-600">정말 삭제하시겠습니까?</h3>
              <p className="text-sm text-gray-600">이 작업은 되돌릴 수 없습니다. 해당 FAQ가 영구적으로 삭제됩니다.</p>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowConfirmDelete(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700">취소</button>
                <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white shadow-sm">
                  {deleteLoading ? "삭제 중..." : "삭제 확인"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
