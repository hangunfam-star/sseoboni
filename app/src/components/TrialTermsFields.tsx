"use client";

import { formatWon } from "@/ui/presentation";
import { TRIAL_HOURS, recommendTierFee } from "@/ui/trial-pricing";

// fees: 구간(시간) → 입력 중인 체험비 문자열. 고른 구간만 보낸다.
export type TermsDraft = { hours: number[]; fees: Record<number, string>; shippingOneWay: string; conditionNote: string };

export const EMPTY_TERMS: TermsDraft = { hours: [24, 48, 72], fees: {}, shippingOneWay: "", conditionNote: "" };

// param: d 입력 중인 조건. return: API로 보낼 값(숫자 변환)
export function termsPayload(d: TermsDraft) {
  return {
    tiers: [...d.hours].sort((a, b) => a - b).map((h) => ({ hours: h, fee: d.fees[h] === undefined || d.fees[h] === "" ? NaN : Number(d.fees[h]) })),
    shippingOneWay: d.shippingOneWay === "" ? null : Number(d.shippingOneWay),
    conditionNote: d.conditionNote,
  };
}

const digits = (v: string) => v.replace(/[^0-9]/g, "");

// param: value 입력 중인 조건, onChange 바뀐 값, price 상품 가격(원, 아직 없으면 0), feePct 지금 수수료율(%)
// return: 판매자가 정하는 써보기 조건 입력칸(구간별 체험비·배송비·추가 조건)과 구매자에게 보일 금액 미리보기
export function TrialTermsFields({ value, onChange, price, feePct }: { value: TermsDraft; onChange: (v: TermsDraft) => void; price: number; feePct: number }) {
  const set = (patch: Partial<TermsDraft>) => onChange({ ...value, ...patch });
  const fee = price > 0 ? Math.round((price * feePct) / 100) : null;

  function toggleHour(h: number) {
    const next = value.hours.includes(h) ? value.hours.filter((x) => x !== h) : [...value.hours, h].sort((a, b) => a - b);
    set({ hours: next });
  }

  function fillRecommended() {
    if (price <= 0) return;
    const fees = { ...value.fees };
    for (const h of value.hours) fees[h] = String(recommendTierFee(price, h));
    set({ fees });
  }

  return (
    <div className="trial-terms">
      <p className="trial-terms__title">써보기 조건 <small>써보고 사면 체험비 0원, 돌려보내면 체험비를 받아요. 정한 구간을 넘기면 다음 구간 요금이에요.</small></p>
      <fieldset className="field">
        <legend>써보게 할 기간 <small>(여러 개 고를 수 있어요)</small></legend>
        <div className="segmented">
          {TRIAL_HOURS.map((h) => (
            <button key={h} type="button" aria-pressed={value.hours.includes(h)} onClick={() => toggleHour(h)}>{h}시간</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>구간별 체험비 <small>(돌려보낼 때만 받아요)</small></legend>
        <div className="tier-fees">
          {[...value.hours].sort((a, b) => a - b).map((h) => (
            <label key={h} className="tier-fees__row">
              <span>{h}시간</span>
              <div className="price-input">
                <input inputMode="numeric" value={value.fees[h] ?? ""} onChange={(e) => set({ fees: { ...value.fees, [h]: digits(e.target.value) } })} placeholder={price > 0 ? String(recommendTierFee(price, h)) : "0"} aria-label={`${h}시간 체험비`} />
                <b>원</b>
              </div>
            </label>
          ))}
        </div>
        <small className="field-hint">
          {price > 0
            ? <>추천: 하루 상품 가격의 약 0.7% · <button type="button" className="link-button" onClick={fillRecommended}>추천 금액 넣기</button></>
            : "가격을 먼저 입력하면 추천 금액을 보여 드려요."}
        </small>
      </fieldset>
      <label className="field">
        <span>편도 배송비 <small>(모르면 비워 두세요)</small></span>
        <div className="price-input">
          <input inputMode="numeric" value={value.shippingOneWay} onChange={(e) => set({ shippingOneWay: digits(e.target.value) })} placeholder="예: 4000" />
          <b>원</b>
        </div>
      </label>
      <label className="field">
        <span>추가 조건 <small>(선택)</small></span>
        <input value={value.conditionNote} onChange={(e) => set({ conditionNote: e.target.value })} maxLength={100} placeholder="예: 흠집이 생기면 수리비는 구매자 부담" />
      </label>
      {fee !== null && (
        <p className="trial-terms__preview">
          구매자는 상품 가격을 미리 결제해요. 써보고 사면 체험비 0원, 판매자님께 {formatWon(price - fee)} 입금(수수료 {feePct}% {formatWon(fee)} 제외). 돌려보내면 판매자님께 체험비가 입금되고, 구매자는 체험비 + 수수료를 뺀 금액을 환불받아요.
          {value.hours.some((h) => value.fees[h]) && <> 예: {[...value.hours].sort((a, b) => a - b).filter((h) => value.fees[h]).map((h) => `${h}시간 ${formatWon(Number(value.fees[h]))}`).join(" · ")}</>}
        </p>
      )}
    </div>
  );
}
