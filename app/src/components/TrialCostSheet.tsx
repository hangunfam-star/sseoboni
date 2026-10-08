"use client";

import { useState } from "react";
import { formatWon } from "@/ui/presentation";
import { computeTrialCost, type TrialTerms } from "@/ui/trial-pricing";

type Choice = "STILL_TRY" | "DECLINE";

// param: listingId 상품 id, price 상품가, terms 판매자가 정한 써보기 조건
// return: 써보기 예상 비용(기간 선택 → 체험비·배송·구매 시/반환 시 금액)과 "이 조건으로 써볼래요"·"부담돼요" 버튼. 결제·신청은 없다.
export function TrialCostSheet({ listingId, price, terms }: { listingId: string; price: number; terms: TrialTerms }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(terms.hours.includes(48) ? 48 : terms.hours[0]);
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const c = computeTrialCost(price, hours, terms);
  const shipKnown = c.shippingOneWay !== null;

  function send(action: "VIEW" | Choice, h = hours) {
    return fetch("/api/trial-cost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, action, hours: h }) });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void send("VIEW");
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
          <p className="trial-cost__tag">판매자가 정한 조건 · 예상 금액 · 아직 결제 없음</p>
          <fieldset className="trial-cost__hours">
            <legend>써보는 기간</legend>
            <div>
              {terms.hours.map((h) => (
                <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)}>{h}시간</button>
              ))}
            </div>
          </fieldset>
          <dl className="trial-cost__table">
            <div><dt>상품 가격</dt><dd>{formatWon(price)}</dd></div>
            <div><dt>체험비 <small>하루 {formatWon(c.dailyFee)} × {c.days}일</small></dt><dd>{formatWon(c.optionFee)}</dd></div>
            <div><dt>배송비 <small>편도</small></dt><dd>{shipKnown ? formatWon(c.shippingOneWay!) : "확정 전"}</dd></div>
          </dl>
          <div className="trial-cost__result">
            <div>
              <small>써보고 사면</small>
              <strong>{formatWon(shipKnown ? c.purchaseTotal! : c.purchaseWithoutShipping)}</strong>
              <small>상품 가격 + 체험비{c.purchaseCredit > 0 ? ` − 돌려받는 체험비 ${formatWon(c.purchaseCredit)}` : ""}{shipKnown ? " + 편도 배송비" : " (배송비 별도)"}</small>
            </div>
            <div>
              <small>써보고 돌려보내면</small>
              <strong>{formatWon(shipKnown ? c.returnTotal! : c.returnWithoutShipping)}</strong>
              <small>체험비{shipKnown ? " + 왕복 배송비" : " (왕복 배송비 별도)"} · 상품 가격은 내지 않아요</small>
            </div>
          </div>
          {terms.conditionNote && <p className="trial-cost__cond"><b>판매자 추가 조건</b> {terms.conditionNote}</p>}
          <p className="trial-cost__note">써보기 결제·배송은 아직 열리지 않았어요. 금액이 맞지 않으면 아래 &apos;써보고 싶어요&apos;에서 직접 제안할 수 있어요.</p>
          <div className="trial-cost__actions">
            <button type="button" className="trial-cost__yes" aria-pressed={chosen === "STILL_TRY"} disabled={pending} onClick={() => choose("STILL_TRY")}>
              {chosen === "STILL_TRY" ? "✓ 이 조건으로 써볼래요" : "이 조건으로 써볼래요"}
            </button>
            <button type="button" className="trial-cost__no" aria-pressed={chosen === "DECLINE"} disabled={pending} onClick={() => choose("DECLINE")}>
              {chosen === "DECLINE" ? "✓ 비용이 부담돼요" : "비용이 부담돼요"}
            </button>
          </div>
          {notice && <p className="trial-cost__notice" role="status">{notice}</p>}
        </div>
      )}
    </div>
  );
}
