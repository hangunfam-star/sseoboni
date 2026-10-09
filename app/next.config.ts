import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상품 사진(/api/photos)만 Next 이미지 최적화 대상으로 허용한다.
  images: { localPatterns: [{ pathname: "/api/photos/**", search: "" }] },
  // 링크 미리보기 수집기(카카오톡 등)에는 메타데이터를 <head>에 바로 넣어 준다(기본 목록 + 카카오·텔레그램·네이버 밴드 등).
  htmlLimitedBots: /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|kakaotalk-scrap|Kakaotalk|TelegramBot|Daum|NaverBand/i,
};

export default nextConfig;
