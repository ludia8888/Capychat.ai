import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CS 로그 → FAQ 단일 문서 | Next.js",
  description: "LLM 기반 FAQ 추출/중복 차단/카테고리 분류",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
