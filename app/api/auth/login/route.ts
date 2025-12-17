import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import {
  authCookieName,
  authCookieOptions,
  createAuthToken,
  verifyPassword,
} from "../../../../lib/auth";

type ChannelChoice = { tenantKey: string; tenantName: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email ?? "").trim().toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    const tenantHint = typeof body?.tenantKey === "string" ? body.tenantKey.trim() : "";

    if (!email || !password) {
      return NextResponse.json({ detail: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
    }

    const invalidCredentials = () => NextResponse.json({ detail: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });

    if (tenantHint) {
      let tenant = await prisma.tenant.findUnique({ where: { key: tenantHint } });
      // Allow logging in using a human-friendly channel name as well.
      if (!tenant) {
        tenant = await prisma.tenant.findFirst({ where: { name: tenantHint } });
      }
      if (!tenant) {
        return NextResponse.json(
          { detail: "채널을 찾을 수 없습니다. 채널 이름(또는 설치 코드)을 확인해 주세요." },
          { status: 404 },
        );
      }

      const user = await prisma.user.findFirst({
        where: { email, tenantId: tenant.id },
      });
      if (!user) return invalidCredentials();

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return invalidCredentials();

      const token = createAuthToken({
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });
      const res = NextResponse.json({
        user: { id: user.id, email: user.email, role: user.role, tenantKey: tenant.key, tenantName: tenant.name },
      });
      res.cookies.set(authCookieName, token, authCookieOptions());
      return res;
    }

    // Auto-detect the channel by email+password.
    const candidates = await prisma.user.findMany({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        passwordHash: true,
        tenant: { select: { key: true, name: true } },
      },
    });
    if (!candidates.length) return invalidCredentials();

    const matches: typeof candidates = [];
    for (const candidate of candidates) {
      const ok = await verifyPassword(password, candidate.passwordHash);
      if (ok) matches.push(candidate);
    }

    if (!matches.length) return invalidCredentials();

    if (matches.length > 1) {
      const choices: ChannelChoice[] = Array.from(
        new Map(matches.map((m) => [m.tenant.key, { tenantKey: m.tenant.key, tenantName: m.tenant.name }])).values(),
      );
      return NextResponse.json(
        {
          detail: "이 이메일로 여러 채널이 확인되었습니다. 로그인할 채널을 선택해 주세요.",
          choices,
        },
        { status: 409 },
      );
    }

    const user = matches[0];
    const token = createAuthToken({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role, tenantKey: user.tenant.key, tenantName: user.tenant.name },
    });
    res.cookies.set(authCookieName, token, authCookieOptions());
    return res;
  } catch (err: any) {
    console.error("POST /api/auth/login error", err);
    return NextResponse.json({ detail: err?.message || "Failed to login" }, { status: 500 });
  }
}
