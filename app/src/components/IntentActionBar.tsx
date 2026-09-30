"use client";

import { useState } from "react";
import WishlistButton from "@/app/listings/[id]/WishlistButton";

type Kind = "TRY" | "BUY";

// 상세 하단 가격 바. 두 버튼은 의향만 기록하며 거래·신청을 시작하지 않는다.
export function IntentActionBar({ listingId, wished, priceLabel, initial }: {
  listingId: string;
  wished: boolean;
  priceLabel: string;
  initial: { TRY: boolean; BUY: boolean };
}) {
  const [done, setDone] = useState(initial);
  const [pending, setPending] = useState<Kind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function record(kind: Kind) {
    if (pending) return;
    setPending(kind);
    setNotice(null);
    const res = await fetch("/api/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, kind }),
    });
    setPending(null);
    if (res.status === 401) {
      setNotice("초대 코드로 로그인하면 의견을 남길 수 있어요.");
      return;
    }
    if (!res.ok) {
      setNotice("지금은 기록하지 못했어요. 잠시 후 다시 눌러 주세요.");
      return;
    }
    setDone((d) => ({ ...d, [kind]: true }));
    setNotice(kind === "TRY" ? "써보고 싶다는 의견을 남겼어요. 써보기는 아직 준비 중이에요." : "사고 싶다는 의견을 남겼어요. 테스트 기간이라 거래는 아직 열리지 않아요.");
  }

  return (
    <div className="intent-action-bar" aria-label="상품 행동">
      {notice && <p className="intent-notice" role="status">{notice}</p>}
      <div className="intent-action-bar__row">
        <WishlistButton listingId={listingId} initialWished={wished} />
        <div className="intent-price"><strong>{priceLabel}</strong><small>테스트 기간 · 결제 없음</small></div>
      </div>
      <div className="intent-action-bar__buttons">
        <button type="button" className="intent-button intent-button--try" onClick={() => record("TRY")} disabled={pending !== null} aria-pressed={done.TRY}>
          {done.TRY ? "✓ 써보고 싶어요" : "써보고 싶어요"}
        </button>
        <button type="button" className="intent-button intent-button--buy" onClick={() => record("BUY")} disabled={pending !== null} aria-pressed={done.BUY}>
          {done.BUY ? "✓ 사고 싶어요" : "사고 싶어요"}
        </button>
      </div>
    </div>
  );
}
