"use client";

import { useState } from "react";
import { formatWon } from "@/ui/presentation";
import { moneyOf } from "@/ui/trade-rules";
import type { TrialTerms } from "@/ui/trial-pricing";

type Choice = "STILL_TRY" | "DECLINE";

// param: listingId 상품 id, price 상품가, terms 판매자 조건, shippingFee 구매자 부담 발송비, tradeOpen 거래 열림, graceHours 체험 뒤 답 기다리는 시간
// return: 판매자 구간별 체험료와 금액(먼저 보낼 금액·사면·돌려보내면). 거래가 닫혀 있으면 "이 조건으로 써볼래요"·"부담돼요" 의견을 받는다.
// 2026-10-09 결정: 돈은 판매자에게 직접 보낸다. 사면 체험료 0원, 돌려보내면 상품가 − 체험료 환불(발송비·반송비 구매자 부담, 반납 수수료 없음).
export function TrialCostSheet({ listingId, price, terms, shippingFee, tradeOpen, graceHours }: { listingId: string; price: number; terms: TrialTerms; shippingFee: number; tradeOpen: boolean; graceHours: number }) {
  const [open, setOpen] = useState(false);
  const hoursList = terms.tiers.map((t) => t.hours);
  const [hours, setHours] = useState(hoursList.includes(48) ? 48 : hoursList[0]);
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tier = terms.tiers.find((t) => t.hours === hours) ?? terms.tiers[0];
  const m = moneyOf(price, shippingFee, tier.fee);
  const idx = hoursList.indexOf(hours);
  const next = idx >= 0 && idx < hoursList.length - 1 ? terms.tiers[idx + 1] : null;

  function send(action: "VIEW" | Choice, h = hours) {
    return fetch("/api/trial-cost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, action, hours: h }) });
  }

  function toggle() {
    const n = !open;
    setOpen(n);
    if (n) void send("VIEW");
  }

  async function choose(action: Choice) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    const res = await send(action);
    setPending(false);
    if (res.status === 401) { setNotice("닉네임을 정하고 시작하면 의견을 남길 수 있어요."); return; }
    if (!res.ok) { setNotice("지금은 기록하지 못했어요. 잠시 후 다시 눌러 주세요."); return; }
    setChosen(action);
    setNotice(action === "STILL_TRY"
      ? `${hours}시간 이 조건으로 써보고 싶다고 남겼어요. 써보기가 열리면 이 조건으로 진행돼요.`
      : "의견 고마워요. 아래 '써보고 싶어요'에서 원하는 금액을 판매자에게 제안해 보세요.");
  }

  return (
    <div className="trial-cost">
      <button type="button" className="trial-cost__toggle" aria-expanded={open} aria-controls={`trial-cost-${listingId}`} onClick={toggle}>
        {open ? "써보기 비용 접기" : "판매자 써보기 조건 · 비용 보기"}
      </button>
      {open && (
        <div id={`trial-cost-${listingId}`} className="trial-cost__body">
          <p className="trial-cost__tag">판매자가 정한 조건 · {tradeOpen ? "판매자에게 직접 입금" : "예상 금액 · 아직 결제 없음"}</p>
          <fieldset className="trial-cost__hours">
            <legend>써보는 기간 <small>(받은 때부터)</small></legend>
            <div>
              {terms.tiers.map((t) => (
                <button key={t.hours} type="button" aria-pressed={hours === t.hours} onClick={() => setHours(t.hours)}>
                  {t.hours}시간<small>{formatWon(t.fee)}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <dl className="trial-cost__table">
            <div><dt>먼저 보낼 금액 <small>상품가 + 발송비 · 판매자 계좌로</small></dt><dd>{formatWon(m.payTotal)}</dd></div>
            <div><dt>체험료 <small>{hours}시간 · 돌려보낼 때만</small></dt><dd>{formatWon(tier.fee)}</dd></div>
            <div><dt>발송비 <small>편도 · 구매자 부담</small></dt><dd>{formatWon(shippingFee)}</dd></div>
          </dl>
          <div className="trial-cost__result">
            <div>
              <small>써보고 사면</small>
              <strong>추가 0원</strong>
              <small>체험료 0원 · 먼저 보낸 금액으로 끝</small>
            </div>
            <div>
              <small>써보고 돌려보내면</small>
              <strong>{formatWon(m.refundIfReturn)} 환불</strong>
              <small>상품가 − 체험료 {formatWon(tier.fee)} · 발송비와 반송비는 구매자 부담</small>
            </div>
          </div>
          <p className="trial-cost__note">
            {next ? `${hours}시간을 넘겨 돌려보내면 ${next.hours}시간 요금(${formatWon(next.fee)})이에요. ` : ""}
            써보기가 끝나고 {graceHours}시간 안에 답이 없으면 구매로 확정돼요.
          </p>
          {terms.conditionNote && <p className="trial-cost__cond"><b>판매자 추가 조건</b> {terms.conditionNote}</p>}
          {tradeOpen ? (
            <p className="trial-cost__note">아래 &apos;써보기 신청&apos;으로 바로 신청할 수 있어요. 금액이 맞지 않으면 다른 조건을 제안해 보세요.</p>
          ) : (
            <>
              <p className="trial-cost__note">써보기 거래는 아직 열리지 않았어요. 금액이 맞지 않으면 아래 &apos;써보고 싶어요&apos;에서 직접 제안할 수 있어요.</p>
              <div className="trial-cost__actions">
                <button type="button" className="trial-cost__yes" aria-pressed={chosen === "STILL_TRY"} disabled={pending} onClick={() => choose("STILL_TRY")}>
                  {chosen === "STILL_TRY" ? "✓ 이 조건으로 써볼래요" : "이 조건으로 써볼래요"}
                </button>
                <button type="button" className="trial-cost__no" aria-pressed={chosen === "DECLINE"} disabled={pending} onClick={() => choose("DECLINE")}>
                  {chosen === "DECLINE" ? "✓ 비용이 부담돼요" : "비용이 부담돼요"}
                </button>
              </div>
            </>
          )}
          {notice && <p className="trial-cost__notice" role="status">{notice}</p>}
        </div>
      )}
    </div>
  );
}
