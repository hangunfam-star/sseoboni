import type { MetadataRoute } from "next";

// 홈 화면에 추가했을 때의 앱 정보(이름·아이콘·전체 화면). 아이콘: 에코백 + 안쪽 순환 화살표(주황→분홍 바탕)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "써보니 — 써보고 사는 중고거래",
    short_name: "써보니",
    description: "판매자가 허락한 중고 제품을 먼저 써보고 살지 정해요",
    id: "/",
    start_url: "/?from=home-screen",
    scope: "/",
    display: "standalone",
    background_color: "#FF8A65",
    theme_color: "#111111",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
