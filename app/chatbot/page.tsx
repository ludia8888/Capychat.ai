import ChatbotClient from "./ChatbotClient";
import { getUserFromCookies } from "../../lib/auth";
import { getChatSettings } from "../../lib/config";
import { prisma } from "../../lib/db";
import { resolveTenantId } from "../../lib/tenant";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

async function autoSelectSingleTenantKey(): Promise<string | null> {
  const tenants = await prisma.tenant.findMany({
    select: { key: true },
    take: 2,
    orderBy: { id: "asc" },
  });
  if (tenants.length === 1) return tenants[0].key;
  return null;
}

function MissingChannel({
  isEmbed,
  message,
}: {
  isEmbed: boolean;
  message?: string;
}) {
  return (
    <div
      className={`${isEmbed ? "h-full min-h-[560px]" : "min-h-screen"} flex items-center justify-center bg-[#F0F0EB] px-4 py-10`}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-[#E5E4DF] p-7 space-y-4 text-center">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">CapyChat</p>
          <h1 className="text-xl font-bold text-gray-900">채널을 지정해 주세요</h1>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          {message || (
            <>
              이 챗봇은 채널(FAQ/챗봇 공간)별로 분리되어 있어요. 공유 링크/임베드 코드에{' '}
              <span className="font-semibold text-gray-800">설치 코드</span>를 포함해 주세요.
            </>
          )}
        </p>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-left">
          <div className="text-xs text-gray-500 mb-1">예시</div>
          <code className="block text-xs font-mono text-gray-800">/chatbot?tenant=설치코드</code>
        </div>

        <p className="text-xs text-gray-500">
          설치 코드는 관리자 화면 상단의 <span className="font-semibold">현재 채널</span>에서 확인할 수 있어요.
        </p>
      </div>
    </div>
  );
}

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getUserFromCookies();

  const rawEmbed = searchParams?.embed;
  const isEmbed = rawEmbed == "1" || (Array.isArray(rawEmbed) && rawEmbed[0] == "1");

  const tenantKeyFromQuery = firstParam(searchParams?.tenant)?.trim();
  const tenantKeyFromUser = user?.tenantKey;

  const envTenantKeyRaw = process.env.NEXT_PUBLIC_TENANT_KEY;
  const envTenantKey = envTenantKeyRaw && envTenantKeyRaw !== "default" ? envTenantKeyRaw : undefined;

  const tenantKey =
    tenantKeyFromQuery || tenantKeyFromUser || envTenantKey || (await autoSelectSingleTenantKey());

  if (!tenantKey) {
    return <MissingChannel isEmbed={!!isEmbed} />;
  }

  const fallbackSettings = {
    headerText: "당특순에게 모두 물어보세요!",
    thumbnailUrl: "/capychat_mascot.png",
    thumbnailDataUrl: "",
  };

  let initialSettings = fallbackSettings;
  try {
    // NOTE: `Request`/Fetch headers only allow ByteString values. Tenant keys/names can be non-ASCII
    // (e.g. Korean), so we pass tenant via query string instead of custom headers.
    const req = new Request(`http://internal/chatbot?tenant=${encodeURIComponent(tenantKey)}`);
    const tenant = await resolveTenantId({ tenantIdFromUser: tenantKeyFromQuery ? undefined : user?.tenantId, req });
    const settings = await getChatSettings(tenant.id);
    initialSettings = {
      headerText: settings.headerText,
      thumbnailUrl: settings.thumbnailUrl,
      thumbnailDataUrl: settings.thumbnailDataUrl,
    };
  } catch (err) {
    console.error("[chatbot page] failed to load chat settings", err);
    return (
      <MissingChannel
        isEmbed={!!isEmbed}
        message="요청하신 채널을 찾을 수 없어요. 링크/임베드 코드의 설치 코드를 다시 확인해 주세요."
      />
    );
  }

  return <ChatbotClient initialSettings={initialSettings} isEmbed={!!isEmbed} tenantKey={tenantKey} />;
}
