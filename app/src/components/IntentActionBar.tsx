"use client";

import { useState } from "react";
import WishlistButton from "@/app/listings/[id]/WishlistButton";
import { ProposalSheet, type MyProposal } from "@/components/ProposalSheet";
import { OrderSheet } from "@/components/OrderSheet";
import type { TrialTerms } from "@/ui/trial-pricing";

type Kind = "TRY" | "BUY";
export type TradeInfo = {
  open: boolean;              // 운영자가 거래를 열었는지
  accountReady: boolean;      // 판매자가 정산 계좌를 등록했는지
  shippingFee: number;
  questionOptions: string[];
  graceHours: number;
  paymentWaitHours: number;
};

// 상세 하단 가격 바.
// - 거래가 열리고 판매자 계좌가 있으면: '구매하기'·'써보기 신청'이 신청 시트를 연다(누른 의향도 함께 기록).
// - 그 밖에는 의향만 기록하고 '써보고 싶어요'는 써보기 제안 시트를 연다.
export function IntentActionBar({ listingId, wished, priceLabel, initial, price, terms, sellerNo, mine, feePct, trade }: {
  listingId: string;
  wished: boolean;
  priceLabel: string;
  initial: { TRY: boolean; BUY: boolean };
  price: number;
  terms: TrialTerms | null;
  sellerNo: boolean;
  mine: MyProposal;
  feePct: number;
  trade: TradeInfo;
}) {
  const [done, setDone] = useState(initial);
  const [proposalSheet, setProposalSheet] = useState(false);
  const [order, setOrder] = useState<null | "BUY" | "TRIAL">(null);
  const [pending, setPending] = useState<Kind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canTrade = trade.open && trade.accountReady;
  const accepted = mine && mine.status === "ACCEPTED" ? mine : null;
  const trialTiers = terms ? terms.tiers : accepted ? [{ hours: accepted.hours, fee: accepted.offerFee }] : null;

  async function record(kind: Kind): Promise<boolean> {
    if (pending) return false;
    setPending(kind);
    setNotice(null);
    const res = await fetch("/api/intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, kind }) });
    setPending(null);
    if (res.status === 401) { setNotice("닉네임을 정하고 시작하면 이용할 수 있어요."); return false; }
    if (!res.ok) { setNotice("지금은 기록하지 못했어요. 잠시 후 다시 눌러 주세요."); return false; }
    setDone((d) => ({ ...d, [kind]: true }));
    return true;
  }

  async function onTry() {
    if (!(await record("TRY"))) return;
    if (canTrade && trialTiers) setOrder("TRIAL");
    else setProposalSheet(true);
  }

  async function onBuy() {
    if (!(await record("BUY"))) return;
    if (canTrade) setOrder("BUY");
    else setNotice(trade.open ? "판매자가 정산 계좌를 등록하면 바로 구매할 수 있어요. 채팅으로 알려 주세요." : "사고 싶다는 의견을 남겼어요. 거래는 곧 열려요.");
  }

  const tryLabel = canTrade && trialTiers ? (terms ? "써보기 신청" : "제안 조건으로 써보기") : done.TRY ? "✓ 써보고 싶어요" : "써보고 싶어요";
  const buyLabel = canTrade ? "구매하기" : done.BUY ? "✓ 사고 싶어요" : "사고 싶어요";
  return (
    <>
    {proposalSheet && <ProposalSheet listingId={listingId} price={price} terms={terms} sellerNo={sellerNo} mine={mine} feePct={feePct} onClose={() => setProposalSheet(false)} />}
    {order && (
      <OrderSheet listingId={listingId} kind={order} price={price} shippingFee={trade.shippingFee} tiers={order === "TRIAL" ? trialTiers : null}
        proposalId={order === "TRIAL" && !terms && accepted ? accepted.id : null} questionOptions={trade.questionOptions}
        graceHours={trade.graceHours} paymentWaitHours={trade.paymentWaitHours} onClose={() => setOrder(null)} />
    )}
    <div className="intent-action-bar" aria-label="상품 행동">
      {notice && <p className="intent-notice" role="status">{notice}</p>}
      <div className="intent-action-bar__row">
        <WishlistButton listingId={listingId} initialWished={wished} />
        <div className="intent-price"><strong>{priceLabel}</strong><small>{canTrade ? "판매자에게 직접 입금 · 써보고 사면 체험료 0원" : "사기 전에 써보기 · 준비 중"}</small></div>
      </div>
      <div className="intent-action-bar__buttons">
        <button type="button" className="intent-button intent-button--try" onClick={() => void onTry()} disabled={pending !== null} aria-pressed={canTrade ? undefined : done.TRY}>{tryLabel}</button>
        <button type="button" className="intent-button intent-button--buy" onClick={() => void onBuy()} disabled={pending !== null} aria-pressed={canTrade ? undefined : done.BUY}>{buyLabel}</button>
      </div>
      {canTrade && trialTiers && <button type="button" className="text-button intent-propose" onClick={() => setProposalSheet(true)}>다른 기간·체험료를 제안하기</button>}
    </div>
    </>
  );
}
