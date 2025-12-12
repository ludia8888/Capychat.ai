import { NextResponse } from "next/server";
import { authCookieName, clearAuthCookieOptions } from "../../../../lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName, "", clearAuthCookieOptions());
  return res;
}
