import type { ReactNode } from "react";

export default function ChannelRequired({
  title = "채널을 지정해 주세요",
  description,
  examplePath,
  actionPath,
  isEmbed = false,
}: {
  title?: string;
  description?: ReactNode;
  examplePath: string;
  actionPath: string;
  isEmbed?: boolean;
}) {
  return (
    <div
      className={`${isEmbed ? "h-full min-h-[560px]" : "min-h-screen"} flex items-center justify-center bg-[#F0F0EB] px-4 py-10`}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-[#E5E4DF] p-7 space-y-5 text-center">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">CapyChat</p>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          {description || (
            <>
              이 페이지는 채널(FAQ/챗봇 공간)별로 분리되어 있어요. 공유 링크/임베드 코드에{" "}
              <span className="font-semibold text-gray-800">설치 코드</span>를 포함해 주세요.
            </>
          )}
        </p>

        <form
          method="get"
          action={actionPath}
          className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left space-y-3"
        >
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">설치 코드</label>
            <input
              name="tenant"
              required
              placeholder="예: dangteuksun"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
            {isEmbed && <input type="hidden" name="embed" value="1" />}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-black/90"
          >
            열기
          </button>

          <div className="text-xs text-gray-500 pt-1">
            예시: <code className="font-mono text-gray-800">{examplePath}</code>
          </div>
        </form>

        <p className="text-xs text-gray-500">
          설치 코드는 관리자 화면 상단의 <span className="font-semibold">현재 채널</span>에서 확인할 수 있어요.
        </p>
      </div>
    </div>
  );
}
