"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// param: listingId, initialWished 내가 찜했는지, variant bar(하단 하트 버튼) | tile(상세 숫자 칸)
// return: 찜 토글. 누르면 화면의 찜 숫자도 바로 다시 그린다(router.refresh). 실패하면 안내를 띄운다.
export default function WishlistButton({ listingId, initialWished, variant = "bar", count }: { listingId: string; initialWished: boolean; variant?: "bar" | "tile"; count?: number }) {
  const router = useRouter();
  const [wished, setWished] = useState(initialWished);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    const res = await fetch("/api/wishlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.status === 401) { alert("먼저 닉네임을 정하고 시작하세요."); return; }
    if (!res.ok || typeof data.wished !== "boolean") { alert(data.error ?? "찜하지 못했어요. 잠시 후 다시 눌러 주세요."); return; }
    setWished(data.wished);
    router.refresh();
  }

  if (variant === "tile") {
    return (
      <button type="button" className="attr-strip__wish" onClick={toggle} disabled={loading} aria-pressed={wished} aria-label={wished ? `찜 해제 (찜 ${count ?? 0})` : `찜하기 (찜 ${count ?? 0})`}>
        <span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z" /></svg></span>
        <strong>{count ?? 0}</strong><small>{wished ? "찜함" : "찜하기"}</small>
      </button>
    );
  }
  return (
    <button
      className="wishlist-button"
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={wished ? "찜 해제" : "찜하기"}
      aria-pressed={wished}
    >
      <span aria-hidden="true">{wished ? "♥" : "♡"}</span>
    </button>
  );
}
