import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CHATBOT_PATH = "/chatbot";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Allow embedding only for /chatbot (ChannelTalk-style iframe widget)
  if (pathname === CHATBOT_PATH || pathname.startsWith(`${CHATBOT_PATH}/`)) {
    res.headers.set("Content-Security-Policy", "frame-ancestors *");
    res.headers.delete("X-Frame-Options");
    return res;
  }

  // Deny iframing for all other pages (clickjacking protection)
  if (!pathname.startsWith("/api")) {
    res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
    res.headers.set("X-Frame-Options", "DENY");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
