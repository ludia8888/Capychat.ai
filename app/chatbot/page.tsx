import { Suspense } from "react";
import ChatbotClient from "./ChatbotClient";
import { getUserFromCookies } from "../../lib/auth";
import { getChatSettings } from "../../lib/config";
import { resolveTenantId } from "../../lib/tenant";

export const dynamic = "force-dynamic";

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getUserFromCookies();
  const rawEmbed = searchParams?.embed;
  const isEmbed = rawEmbed === "1" || (Array.isArray(rawEmbed) && rawEmbed[0] === "1");

  const rawTenantFromQuery = searchParams?.tenant;
  const tenantKeyFromQuery =
    typeof rawTenantFromQuery === "string" ? rawTenantFromQuery : Array.isArray(rawTenantFromQuery) ? rawTenantFromQuery[0] ?? "" : "";
  const tenantKeyFromEnv = process.env.NEXT_PUBLIC_TENANT_KEY || "default";
  const tenantKey = tenantKeyFromQuery || user?.tenantKey || tenantKeyFromEnv;

  const fallbackSettings = {
    headerText: "당특순에게 모두 물어보세요!",
    thumbnailUrl: "/capychat_mascot.png",
    thumbnailDataUrl: "",
  };

  let initialSettings = fallbackSettings;
  try {
    const req = new Request("http://internal/chatbot", {
      headers: { "x-tenant-key": tenantKey },
    });
    const tenant = await resolveTenantId({ tenantIdFromUser: tenantKeyFromQuery ? undefined : user?.tenantId, req });
    const settings = await getChatSettings(tenant.id);
    initialSettings = {
      headerText: settings.headerText,
      thumbnailUrl: settings.thumbnailUrl,
      thumbnailDataUrl: settings.thumbnailDataUrl,
    };
  } catch (err) {
    console.error("[chatbot page] failed to load chat settings", err);
  }

  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">챗봇 로딩 중...</div>}>
      <ChatbotClient initialSettings={initialSettings} isEmbed={isEmbed} tenantKey={tenantKey} />
    </Suspense>
  );
}
