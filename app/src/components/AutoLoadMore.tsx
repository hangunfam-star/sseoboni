"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// param: href 다음 쪽까지 보이는 주소. 목록 끝이 화면에 가까워지면 저절로 다음 쪽을 불러온다(더 보기 버튼 대신).
// 화면 위치는 그대로 둔다. 화면 읽기 사용자를 위해 숨은 링크를 하나 둔다.
export function AutoLoadMore({ href }: { href: string }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || asked.current === href) return;
      asked.current = href; // 같은 쪽을 두 번 부르지 않는다
      setLoading(true);
      router.replace(href, { scroll: false });
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [href, router]);

  return (
    <div ref={box} className="auto-more" aria-live="polite">
      {loading && <span className="auto-more__spinner" aria-label="상품을 더 불러오는 중" />}
      <Link className="sr-only" href={href} scroll={false}>상품 더 보기</Link>
    </div>
  );
}
