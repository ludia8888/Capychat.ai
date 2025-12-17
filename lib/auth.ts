import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./db";

export const authCookieName = "auth_token";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일

export class AuthError extends Error {
  status: number;
  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const authSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return secret;
};

export const authCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TOKEN_TTL_MS / 1000,
});

export const clearAuthCookieOptions = () => ({
  ...authCookieOptions(),
  maxAge: 0,
});

export type PublicUser = {
  id: number;
  email: string;
  role: string;
  tenantId: number;
};

export type PublicUserWithTenant = PublicUser & { tenantKey: string };

export type PublicUserWithTenantAndName = PublicUserWithTenant & { tenantName: string };

const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scrypt(password, salt);
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, hashBuf);
}

type TokenPayload = { sub: number; tenantId: number; email: string; role: string; exp: number };

export function createAuthToken(user: PublicUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", authSecret()).update(payloadEncoded).digest("base64url");
  return `${payloadEncoded}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload {
  const [payloadEncoded, sig] = token.split(".");
  if (!payloadEncoded || !sig) throw new AuthError("Invalid token", 401);
  const expected = crypto.createHmac("sha256", authSecret()).update(payloadEncoded).digest("base64url");
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    throw new AuthError("Invalid token signature", 401);
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf8"));
  } catch {
    throw new AuthError("Invalid token payload", 401);
  }
  if (payload.exp && Date.now() > payload.exp) {
    throw new AuthError("Token expired", 401);
  }
  return payload;
}

export async function getUserFromCookies(): Promise<PublicUserWithTenantAndName | null> {
  const token = cookies().get(authCookieName)?.value;
  if (!token) return null;
  try {
    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, tenantId: true, tenant: { select: { key: true, name: true } } },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantKey: user.tenant.key,
      tenantName: user.tenant.name,
    };
  } catch (err) {
    console.warn("[auth] token invalid:", (err as Error)?.message);
    return null;
  }
}

export async function requireAdmin(): Promise<PublicUserWithTenantAndName> {
  const user = await getUserFromCookies();
  if (!user) throw new AuthError("Unauthorized", 401);
  if (user.role !== "admin") throw new AuthError("Forbidden", 403);
  return user;
}
