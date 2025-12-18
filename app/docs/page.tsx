import { redirect } from "next/navigation";

import ChannelRequired from "../_components/ChannelRequired";
import DocsClient from "./DocsClient";

import { getUserFromCookies } from "../../lib/auth";
import { prisma } from "../../lib/db";

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

export default async function DocsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getUserFromCookies();

  const tenantKeyFromQuery = firstParam(searchParams?.tenant)?.trim();

  const envTenantKeyRaw = process.env.NEXT_PUBLIC_TENANT_KEY;
  const envTenantKey = envTenantKeyRaw && envTenantKeyRaw !== "default" ? envTenantKeyRaw : undefined;

  if (!tenantKeyFromQuery) {
    const fallbackTenantKey = user?.tenantKey || envTenantKey || (await autoSelectSingleTenantKey());

    if (fallbackTenantKey) {
      const params = new URLSearchParams();
      params.set("tenant", fallbackTenantKey);
      redirect(`/docs?${params.toString()}`);
    }

    return (
      <ChannelRequired
        title="채널을 지정해 주세요"
        actionPath="/docs"
        examplePath="/docs?tenant=설치코드"
      />
    );
  }

  return <DocsClient tenantKey={tenantKeyFromQuery} />;
}
