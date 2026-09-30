import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "써보니 — 체험형 중고거래",
  description: "판매자가 허용한 중고제품을 직접 써보고 구매를 결정하는 플랫폼 (Gate 0 검증용)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
