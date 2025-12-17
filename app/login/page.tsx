"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const defaultTenantKey = process.env.NEXT_PUBLIC_TENANT_KEY || "";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [loginChannelId, setLoginChannelId] = useState(defaultTenantKey);
  const [signupChannelId, setSignupChannelId] = useState("");
  const [signupChannelIdTouched, setSignupChannelIdTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const slugifyChannelId = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "-");

  const isLoginDisabled = loading || !email || password.length < 8;
  const isSignupDisabled = loading || !email || password.length < 8 || !tenantName;

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

  useEffect(() => {
    if (mode !== "signup") return;
    if (signupChannelIdTouched) return;
    const generated = slugifyChannelId(tenantName);
    setSignupChannelId(generated);
  }, [mode, tenantName, signupChannelIdTouched]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        mode === "login"
          ? { email, password, tenantKey: loginChannelId || undefined }
          : { email, password, tenantName, tenantKey: signupChannelId || undefined };
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
          <h1 className="text-2xl font-bold text-gray-800">{mode === "login" ? "관리자 로그인" : "새 채널 만들기"}</h1>
          <p className="text-sm text-gray-600">
            {mode === "login"
              ? "채널(FAQ/챗봇 공간)에 로그인합니다."
              : "새 채널을 만들고 관리자 계정을 생성합니다."}
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
            새 채널 만들기
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700 space-y-2">
          <p className="font-semibold text-gray-800">채널 안내</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              채널은 FAQ/챗봇이 붙는 “공간”이에요. 채널마다 데이터가 완전히 분리됩니다.
            </li>
            <li>
              채널 ID는 임베드/URL에 쓰는 값입니다. 예: <span className="font-mono">/chatbot?tenant=채널ID</span> 또는 위젯 <span className="font-mono">data-tenant</span>.
            </li>
            <li>
              로그인은 <span className="font-semibold">채널 ID(또는 채널 이름)</span> + 이메일/비밀번호로 진행돼요.
            </li>
            <li>
              새 채널 만들기에서는 채널 이름이 필수이고, 채널 ID는 자동 생성되며(필요하면 수정 가능) 생성 후 바로 로그인됩니다.
            </li>
          </ul>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">채널 이름</label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 text-black"
                placeholder="예: 당특순"
                required
              />
              <p className="text-[11px] text-gray-500">사용자에게 보이는 이름(헤더/설정 화면)에 쓰입니다.</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{mode === "login" ? "채널 ID 또는 이름" : "채널 ID (임베드용)"}</label>
            <input
              type="text"
              value={mode === "login" ? loginChannelId : signupChannelId}
              onChange={(e) => {
                if (mode === "login") {
                  setLoginChannelId(e.target.value);
                } else {
                  setSignupChannelIdTouched(true);
                  setSignupChannelId(e.target.value);
                }
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 text-black"
              placeholder={mode === "login" ? "예: 당특순 또는 dangteuksun" : "예: dangteuksun (자동 생성/수정 가능)"}
            />
            <p className="text-[11px] text-gray-500">
              {mode === "login"
                ? "미입력 시 기본 채널로 로그인됩니다. (여러 채널을 쓰는 경우 채널 ID를 입력하세요)"
                : "URL/임베드 코드에서 쓰는 값입니다. 한글도 가능하지만 영문/숫자/하이픈을 추천해요."}
            </p>
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

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={mode === "login" ? isLoginDisabled : isSignupDisabled}
            className="w-full rounded-lg bg-black text-white py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "생성 후 로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
