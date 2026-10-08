"use client";

import { formatWon } from "@/ui/presentation";
import { CREDIT_OPTIONS, TRIAL_HOURS, computeTrialCost, recommendDailyFee } from "@/ui/trial-pricing";

export type TermsDraft = { hours: number[]; dailyFee: string; purchaseCreditPct: number; shippingOneWay: string; conditionNote: string };

export const EMPTY_TERMS: TermsDraft = { hours: [48], dailyFee: "", purchaseCreditPct: 0, shippingOneWay: "", conditionNote: "" };

// param: d 입력 중인 조건. return: API로 보낼 값(숫자 변환)
export function termsPayload(d: TermsDraft) {
  return {
    hours: d.hours,
    dailyFee: d.dailyFee === "" ? NaN : Number(d.dailyFee),
    purchaseCreditPct: d.purchaseCreditPct,
    shippingOneWay: d.shippingOneWay === "" ? null : Number(d.shippingOneWay),
    conditionNote: d.conditionNote,
  };
}

const digits = (v: string) => v.replace(/[^0-9]/g, "");

// param: value 입력 중인 조건, onChange 바뀐 값, price 상품 가격(원, 아직 없으면 0)
// return: 판매자가 정하는 써보기 조건 입력칸(기간·하루 체험비·사면 돌려줄 비율·배송비·추가 조건)과 구매자에게 보일 금액 미리보기
export function TrialTermsFields({ value, onChange, price }: { value: TermsDraft; onChange: (v: TermsDraft) => void; price: number }) {
  const set = (patch: Partial<TermsDraft>) => onChange({ ...value, ...patch });
  const recommended = price > 0 ? recommendDailyFee(price) : null;
  const fee = value.dailyFee === "" ? null : Number(value.dailyFee);
  const longest = value.hours.length > 0 ? Math.max(...value.hours) : null;
  const preview = price > 0 && fee !== null && longest !== null
    ? computeTrialCost(price, longest, { hours: value.hours, dailyFee: fee, purchaseCreditPct: value.purchaseCreditPct, shippingOneWay: value.shippingOneWay === "" ? null : Number(value.shippingOneWay), conditionNote: null })
    : null;

  function toggleHour(h: number) {
    const next = value.hours.includes(h) ? value.hours.filter((x) => x !== h) : [...value.hours, h].sort((a, b) => a - b);
    set({ hours: next });
  }

  return (
    <div className="trial-terms">
      <p className="trial-terms__title">써보기 조건 <small>구매자에게 이 조건과 예상 금액이 보여요</small></p>
      <fieldset className="field">
        <legend>써보게 할 기간 <small>(여러 개 고를 수 있어요)</small></legend>
        <div className="segmented">
          {TRIAL_HOURS.map((h) => (
            <button key={h} type="button" aria-pressed={value.hours.includes(h)} onClick={() => toggleHour(h)}>{h}시간</button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>하루 체험비</span>
        <div className="price-input">
          <input inputMode="numeric" value={value.dailyFee} onChange={(e) => set({ dailyFee: digits(e.target.value) })} placeholder={recommended ? String(recommended) : "0"} aria-describedby="fee-hint" />
          <b>원</b>
        </div>
        <small className="field-hint" id="fee-hint">
          {recommended
            ? <>추천 {formatWon(recommended)}(상품 가격의 약 0.7%) · <button type="button" className="link-button" onClick={() => set({ dailyFee: String(recommended) })}>추천 금액 넣기</button></>
            : "가격을 먼저 입력하면 추천 금액을 보여 드려요."}
        </small>
      </label>
      <fieldset className="field">
        <legend>써보고 사면 체험비는?</legend>
        <div className="segmented">
          {CREDIT_OPTIONS.map((c) => (
            <button key={c.pct} type="button" aria-pressed={value.purchaseCreditPct === c.pct} onClick={() => set({ purchaseCreditPct: c.pct })}>{c.label}</button>
          ))}
        </div>
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
      {preview && (
        <p className="trial-terms__preview">
          {preview.hours}시간 써보면 체험비 <b>{formatWon(preview.optionFee)}</b> · 사면 <b>{formatWon(preview.purchaseTotal ?? preview.purchaseWithoutShipping)}</b>{preview.purchaseTotal === null ? "(배송비 별도)" : ""} · 돌려보내면 <b>{formatWon(preview.returnTotal ?? preview.returnWithoutShipping)}</b>{preview.returnTotal === null ? "(왕복 배송비 별도)" : ""}
        </p>
      )}
    </div>
  );
}
