import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import {
  authCookieName,
  authCookieOptions,
  createAuthToken,
  verifyPassword,
} from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email ?? "").trim().toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    const tenantKey =
      typeof body?.tenantKey === "string" && body.tenantKey.trim()
        ? body.tenantKey.trim()
        : process.env.NEXT_PUBLIC_TENANT_KEY || "default";

    if (!email || !password || !tenantKey) {
      return NextResponse.json({ detail: "email, password and tenantKey are required" }, { status: 400 });
    }

    let tenant = await prisma.tenant.findUnique({ where: { key: tenantKey } });
    // Allow logging in using a human-friendly channel name as well.
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({ where: { name: tenantKey } });
    }
    if (!tenant) {
      return NextResponse.json(
        { detail: "채널을 찾을 수 없습니다. 채널 ID(또는 채널 이름)를 확인하세요." },
        { status: 404 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { email, tenantId: tenant.id },
    });
    if (!user) {
      return NextResponse.json({ detail: "invalid credentials" }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ detail: "invalid credentials" }, { status: 401 });
    }

    const token = createAuthToken({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
    const res = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role, tenantKey: tenant.key } });
    res.cookies.set(authCookieName, token, authCookieOptions());
    return res;
  } catch (err: any) {
    console.error("POST /api/auth/login error", err);
    return NextResponse.json({ detail: err?.message || "Failed to login" }, { status: 500 });
  }
}
