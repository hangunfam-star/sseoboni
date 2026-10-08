import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "써보니 — 체험형 중고거래",
  description: "판매자가 허용한 중고제품을 직접 써보고 구매를 결정하는 플랫폼 (Gate 0 검증용)",
  // 휴대폰 브라우저 자동 번역이 한국어 문구를 바꾸지 않도록 막는다.
  other: { google: "notranslate" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" translate="no" className="notranslate">
      <head>
        {/* Pretendard(OFL) — 한글 본문·제목 공통 글꼴, 사용하는 글자만 나눠 받는 dynamic subset */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
