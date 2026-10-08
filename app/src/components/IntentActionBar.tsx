"use client";

import { useState } from "react";
import WishlistButton from "@/app/listings/[id]/WishlistButton";
import { ProposalSheet, type MyProposal } from "@/components/ProposalSheet";
import type { TrialTerms } from "@/ui/trial-pricing";

type Kind = "TRY" | "BUY";

// 상세 하단 가격 바. '써보고 싶어요'는 의향을 기록하고 써보기 제안 시트를 연다. '사고 싶어요'는 의향만 기록한다. 결제는 없다.
export function IntentActionBar({ listingId, wished, priceLabel, initial, price, terms, sellerNo, mine, feePct }: {
  listingId: string;
  wished: boolean;
  priceLabel: string;
  initial: { TRY: boolean; BUY: boolean };
  price: number;
  terms: TrialTerms | null;
  sellerNo: boolean;
  mine: MyProposal;
  feePct: number;
}) {
  const [done, setDone] = useState(initial);
  const [sheet, setSheet] = useState(false);
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
      setNotice("닉네임을 정하고 시작하면 의견을 남길 수 있어요.");
      return;
    }
    if (!res.ok) {
      setNotice("지금은 기록하지 못했어요. 잠시 후 다시 눌러 주세요.");
      return;
    }
    setDone((d) => ({ ...d, [kind]: true }));
    if (kind === "TRY") setSheet(true);
    else setNotice("사고 싶다는 의견을 남겼어요. 테스트 기간이라 거래는 아직 열리지 않아요.");
  }

  return (
    <>
    {sheet && <ProposalSheet listingId={listingId} price={price} terms={terms} sellerNo={sellerNo} mine={mine} feePct={feePct} onClose={() => setSheet(false)} />}
    <div className="intent-action-bar" aria-label="상품 행동">
      {notice && <p className="intent-notice" role="status">{notice}</p>}
      <div className="intent-action-bar__row">
        <WishlistButton listingId={listingId} initialWished={wished} />
        <div className="intent-price"><strong>{priceLabel}</strong><small>사기 전에 써보기 · 준비 중</small></div>
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
    </>
  );
}
