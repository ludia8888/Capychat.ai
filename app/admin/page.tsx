import { redirect } from "next/navigation";
import { headers } from "next/headers";

import AdminClient from "./AdminClient";

import { getUserFromCookies } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getUserFromCookies();

  if (!user || user.role !== "admin") {
    redirect("/login");
  }

  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const origin = host ? `${proto}://${host}` : "";

  return <AdminClient initialOrigin={origin} />;
}
