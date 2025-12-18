import { redirect } from "next/navigation";

import ChatbotClient from "./ChatbotClient";
import ChannelRequired from "../_components/ChannelRequired";

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

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getUserFromCookies();

  const rawEmbed = searchParams?.embed;
  const isEmbed = rawEmbed == "1" || (Array.isArray(rawEmbed) && rawEmbed[0] == "1");

  const tenantKeyFromQuery = firstParam(searchParams?.tenant)?.trim();

  const envTenantKeyRaw = process.env.NEXT_PUBLIC_TENANT_KEY;
  const envTenantKey = envTenantKeyRaw && envTenantKeyRaw !== "default" ? envTenantKeyRaw : undefined;

  if (!tenantKeyFromQuery) {
    const fallbackTenantKey = user?.tenantKey || envTenantKey || (await autoSelectSingleTenantKey());

    if (fallbackTenantKey) {
      const params = new URLSearchParams();
      params.set("tenant", fallbackTenantKey);
      if (isEmbed) params.set("embed", "1");
      redirect(`/chatbot?${params.toString()}`);
    }

    return (
      <ChannelRequired
        isEmbed={!!isEmbed}
        title="채널을 지정해 주세요"
        actionPath="/chatbot"
        examplePath="/chatbot?tenant=설치코드"
      />
    );
  }

  let initialSettings = {
    headerText: "당특순에게 모두 물어보세요!",
    thumbnailUrl: "/capychat_mascot.png",
    thumbnailDataUrl: "",
  };

  try {
    // NOTE: `Request`/Fetch headers only allow ByteString values. Tenant keys/names can be non-ASCII
    // (e.g. Korean), so we pass tenant via query string instead of custom headers.
    const req = new Request(`http://internal/chatbot?tenant=${encodeURIComponent(tenantKeyFromQuery)}`);
    const tenant = await resolveTenantId({ req });
    const settings = await getChatSettings(tenant.id);
    initialSettings = {
      headerText: settings.headerText,
      thumbnailUrl: settings.thumbnailUrl,
      thumbnailDataUrl: settings.thumbnailDataUrl,
    };
  } catch (err) {
    console.error("[chatbot page] failed to load chat settings", err);
    return (
      <ChannelRequired
        isEmbed={!!isEmbed}
        title="요청하신 채널을 찾을 수 없어요"
        description="링크/임베드 코드의 설치 코드를 다시 확인해 주세요."
        actionPath="/chatbot"
        examplePath="/chatbot?tenant=설치코드"
      />
    );
  }

  return (
    <ChatbotClient
      initialSettings={initialSettings}
      isEmbed={!!isEmbed}
      tenantKey={tenantKeyFromQuery}
    />
  );
}
