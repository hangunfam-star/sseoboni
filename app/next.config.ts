import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상품 사진(/api/photos)만 Next 이미지 최적화 대상으로 허용한다.
  images: { localPatterns: [{ pathname: "/api/photos/**", search: "" }] },
};

export default nextConfig;
