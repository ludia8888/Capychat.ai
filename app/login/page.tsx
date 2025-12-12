"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const defaultTenantKey = process.env.NEXT_PUBLIC_TENANT_KEY || "default";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantKey, setTenantKey] = useState(defaultTenantKey);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let canceled = false;
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok && !canceled) {
          router.replace("/admin");
        }
      } catch {
        // ignore
      }
    };
    checkSession();
    return () => {
      canceled = true;
    };
  }, [router]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        mode === "login"
          ? { email, password, tenantKey: tenantKey || undefined }
          : { email, password, tenantName, tenantKey: tenantKey || undefined };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || (mode === "login" ? "로그인에 실패했습니다." : "회원가입에 실패했습니다."));
      }
      router.replace("/admin");
    } catch (err: any) {
      setError(err?.message || "요청 처리 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F0EB] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-[#E5E4DF] p-8 space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Admin Access</p>
          <h1 className="text-2xl font-bold text-gray-800">{mode === "login" ? "관리자 로그인" : "사업/계정 생성"}</h1>
          <p className="text-sm text-gray-600">
            {mode === "login" ? "등록된 이메일과 비밀번호로 로그인하세요." : "신규 사업(테넌트)을 만들고 관리자 계정을 생성합니다."}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${
              mode === "login" ? "bg-black text-white border-black" : "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${
              mode === "signup" ? "bg-black text-white border-black" : "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            회원가입(새 테넌트)
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700 space-y-2">
          <p className="font-semibold text-gray-800">이용 안내</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>회원가입(새 테넌트)에서 테넌트 키/이름 + 이메일/비밀번호를 넣으면 새 사업(테넌트)와 관리자 계정이 생성되고 자동 로그인됩니다.</li>
            <li>이미 만든 테넌트로 로그인하려면 테넌트 키와 해당 이메일/비밀번호로 로그인 탭에서 접속하세요.</li>
            <li>테넌트 키별로 데이터가 완전히 분리되니, 같은 키를 입력하면 같은 사업 데이터에 접근합니다.</li>
            <li>입력 칸의 테넌트 키 기본값은 환경변수(NEXT_PUBLIC_TENANT_KEY)로 채워질 수 있지만, 다른 테넌트로 접속하려면 값을 변경하세요.</li>
          </ul>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">테넌트 키</label>
            <input
              type="text"
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 text-black"
              placeholder="예: brand-a (비우면 기본값 사용)"
              required={mode === "signup"}
            />
            <p className="text-[11px] text-gray-500">동일 키로 로그인하면 같은 사업 데이터에 접근합니다.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 text-black"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-3 text-lg font-semibold tracking-[0.1em] outline-none focus:ring-2 focus:ring-black/10 text-black"
              placeholder="8자 이상"
              required
              minLength={8}
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">사업/테넌트 이름</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 text-black"
                  placeholder="예: 브랜드 A"
                  required={mode === "signup"}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={
              loading ||
              !email ||
              password.length < 8 ||
              (mode === "signup" && !tenantName)
            }
            className="w-full rounded-lg bg-black text-white py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "생성 후 로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
