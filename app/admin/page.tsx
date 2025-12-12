"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";

type FAQItem = {
  id: number;
  category: string | null;
  title: string;
  content: string;
  sourceType?: string | null;
  confidence?: number | null;
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
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [lastAddedCount, setLastAddedCount] = useState<number | null>(null);
  const [lastSkippedCount, setLastSkippedCount] = useState<number | null>(null);
  const [lastTotalCount, setLastTotalCount] = useState<number | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "category">("category");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingCategories, setEditingCategories] = useState<Record<number, string>>({});
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

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

  const selectFaq = (item: FAQItem) => {
    setSelectedFaq(item);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditCategory(item.category ?? "");
    setSuccessMessage("");
    setEditingCategories((prev) => ({ ...prev, [item.id]: item.category ?? "" }));
  };

  const clearSelection = () => {
    setSelectedFaq(null);
    setEditTitle("");
    setEditContent("");
    setEditCategory("");
    setSelectedIds(new Set());
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

  const handleSave = async () => {
    if (!selectedFaq?.id) return;
    setSaveLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = { title: editTitle, content: editContent, category: editCategory };
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
          </div>

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
                  {selectedFaq && (
                    <button className="text-xs" style={{ color: ui.muted }} onClick={clearSelection}>
                      선택 해제
                    </button>
                  )}
                </div>
                {selectedFaq ? (
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
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        disabled={saveLoading}
                        onClick={handleSave}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: ui.accent, color: "#fff", border: `1px solid ${ui.border}` }}
                      >
                        {saveLoading && (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-t-white" />
                        )}
                        저장
                      </button>
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
