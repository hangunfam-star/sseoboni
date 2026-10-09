"use client";
import Image from "next/image";
import { useState } from "react";

const RETRY_MS = [1500, 4000]; // 사진을 못 받으면(서버 재시작·느린 연결) 이 간격으로 다시 받는다

// param: src 사진 주소, alt 설명, sizes 표시 크기, className 클래스, fallback 끝내 못 받았을 때 대신 보여 줄 그림
// return: 목록용 사진(fill). 실패하면 두 번 다시 받고, 그래도 안 되면 깨진 아이콘 대신 fallback
export function SafePhoto({ src, alt, sizes, className, fallback }: { src: string; alt: string; sizes: string; className?: string; fallback: React.ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <Image
      key={attempt}
      className={className}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      onError={() => {
        if (attempt < RETRY_MS.length) setTimeout(() => setAttempt((a) => a + 1), RETRY_MS[attempt]);
        else setFailed(true);
      }}
    />
  );
}
