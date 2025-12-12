import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { authCookieName, authCookieOptions, createAuthToken, hashPassword } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email ?? "").trim().toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    const tenantName = (body?.tenantName ?? "").trim();
    const tenantKey = (body?.tenantKey ?? "").trim() || tenantName.toLowerCase().replace(/\s+/g, "-") || "default";

    if (!email || !password || !tenantName) {
      return NextResponse.json({ detail: "email, password, tenantName are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ detail: "password must be at least 8 characters" }, { status: 400 });
    }

    let tenant = await prisma.tenant.findUnique({ where: { key: tenantKey } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: tenantName, key: tenantKey },
      });
    }

    const existing = await prisma.user.findFirst({
      where: { email, tenantId: tenant.id },
    });
    if (existing) {
      return NextResponse.json({ detail: "user already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: "admin", tenantId: tenant.id },
    });
    const token = createAuthToken({ id: user.id, email: user.email, role: user.role, tenantId: tenant.id });
    const res = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role, tenantKey: tenant.key } });
    res.cookies.set(authCookieName, token, authCookieOptions());
    return res;
  } catch (err: any) {
    console.error("POST /api/auth/signup error", err);
    return NextResponse.json({ detail: err?.message || "Failed to sign up" }, { status: 500 });
  }
}
