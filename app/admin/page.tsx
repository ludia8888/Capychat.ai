import { redirect } from "next/navigation";

import AdminClient from "./AdminClient";

import { getUserFromCookies } from "../../lib/auth";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getUserFromCookies();

  if (!user || user.role !== "admin") {
    redirect("/login");
  }

  const tenantKeyFromQuery = firstParam(searchParams?.tenant)?.trim();

  if (!tenantKeyFromQuery || tenantKeyFromQuery !== user.tenantKey) {
    const params = new URLSearchParams();
    params.set("tenant", user.tenantKey);
    redirect(`/admin?${params.toString()}`);
  }

  return <AdminClient />;
}
