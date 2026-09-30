"use client";
import { useState } from "react";

export default function WishlistButton({ listingId, initialWished }: { listingId: string; initialWished: boolean }) {
  const [wished, setWished] = useState(initialWished);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/wishlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    if (res.status === 401) {
      alert("먼저 초대 코드로 로그인하세요.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setWished(data.wished);
    setLoading(false);
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
