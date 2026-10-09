import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "써보니 — 체험형 중고거래",
  description: "판매자가 허용한 중고제품을 직접 써보고 구매를 결정하는 플랫폼 (Gate 0 검증용)",
  // 휴대폰 브라우저 자동 번역이 한국어 문구를 바꾸지 않도록 막는다.
  other: { google: "notranslate" },
};

// return: 이 PC에서 직접 연 요청이면 true. 터널(ngrok)을 거치면 Host가 공개 주소이고 X-Forwarded-For에 바깥 IP가 붙는다.
// Next 서버도 X-Forwarded-For를 붙이므로, 모든 값이 이 PC 자신의 주소(루프백)일 때만 로컬로 본다.
const LOOPBACK = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];
async function isLocalRequest(): Promise<boolean> {
  const h = await headers();
  const host = (h.get("host") ?? "").replace(/:\d+$/, "");
  const forwarded = (h.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return ["localhost", "127.0.0.1", "[::1]"].includes(host) && forwarded.every((ip) => LOOPBACK.includes(ip));
}

const SPLASH_ONCE = "try{if(sessionStorage.getItem('sb_splash')){document.documentElement.classList.add('no-splash')}else{sessionStorage.setItem('sb_splash','1')}}catch(e){}";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isLocal = await isLocalRequest();
  return (
    <html lang="ko" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        {/* Pretendard(OFL) — 한글 본문·제목 공통 글꼴, 사용하는 글자만 나눠 받는 dynamic subset */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        {/* 이모지: PC(특히 Windows 10)에 없는 최신 이모지만 Noto Color Emoji로 채운다(쓰인 글자 범위만 받아 옴) */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* 앱 라우터 최상위 layout이라 모든 화면에 적용된다(pages 라우터용 경고 제외) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" />
        {/* 로딩 화면은 탭마다 처음 한 번만 보여 준다(그 뒤 이동·새로고침에서는 바로 숨김). 저장소를 못 쓰면 매번 보이지만 1.9초 뒤 스스로 사라진다. */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_ONCE }} />
      </head>
      <body>
        <div className="splash" aria-hidden="true">
          <div className="splash__top">
            <strong className="splash__logo">써보니<span>.</span></strong>
            <i className="splash__rule" />
            <p className="splash__title">사기 전에,<br />써보고 사세요</p>
          </div>
          <div className="splash__bottom">
            <p className="splash__copy"><em>사진만 보고 산 중고, 후회했나요?</em><br />이제 집에서 먼저 써보고 결정해요</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="splash__photo" src="/hero/splash.webp" alt="" width={720} height={894} fetchPriority="high" />
            <small className="splash__note">AI로 만든 연출 이미지</small>
          </div>
        </div>
        <AppShell isLocal={isLocal}>{children}</AppShell>
      </body>
    </html>
  );
}
