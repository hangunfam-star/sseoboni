import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "써보니 — 체험형 중고거래",
  description: "판매자가 허용한 중고제품을 직접 써보고 구매를 결정하는 플랫폼 (Gate 0 검증용)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <header style={{ borderBottom: "1px solid #ddd", padding: "12px 20px", display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/" style={{ fontWeight: 700, textDecoration: "none", color: "#111" }}>써보니</a>
          <a href="/listings/new" style={{ textDecoration: "none", color: "#333" }}>상품 등록</a>
          <a href="/demand" style={{ textDecoration: "none", color: "#333" }}>찾는 상품</a>
          <a href="/login" style={{ textDecoration: "none", color: "#333", marginLeft: "auto" }}>로그인</a>
        </header>
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>{children}</main>
      </body>
    </html>
  );
}
