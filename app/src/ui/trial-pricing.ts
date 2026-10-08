// 써보기 비용 계산. 금액 조건은 판매자가 상품 등록·수정 때 정한다(listing_trial_terms).
// 결제·정산은 아직 없다. 구매자에게는 "판매자 조건으로 계산한 예상 금액"으로만 보여 준다.

export const TRIAL_HOURS = [24, 48, 72] as const; // 마스터 기획 §7 초기 검증 기간
export const CREDIT_OPTIONS = [
  { pct: 0, label: "안 돌려줘요" },
  { pct: 50, label: "절반 돌려줘요" },
  { pct: 100, label: "전부 돌려줘요" },
] as const;

export type TrialTerms = {
  hours: number[];               // 고를 수 있는 기간(시간)
  dailyFee: number;              // 하루 체험비(원)
  purchaseCreditPct: number;     // 사면 체험비 중 돌려주는 비율(%)
  shippingOneWay: number | null; // 편도 배송비 예상(원), 모르면 null
  conditionNote: string | null;  // 추가 조건 메모
};

const round100 = (v: number) => Math.round(v / 100) * 100;

// param: price 상품가(원)
// return: 판매자에게 보여 줄 추천 하루 체험비. 상품가 0.7%를 2,000~10,000원으로 자르고 100원 단위(§8 과거 예시 기준, 참고용)
export function recommendDailyFee(price: number): number {
  return round100(Math.min(10000, Math.max(2000, price * 0.007)));
}

export type TrialCost = {
  hours: number;
  days: number;
  dailyFee: number;
  optionFee: number;        // 체험비(기간 전체)
  purchaseCredit: number;   // 사면 돌려받는 체험비
  shippingOneWay: number | null;
  purchaseTotal: number | null; // 사면: 상품가 + 체험비 - 돌려받는 체험비 + 편도 배송. 배송비 모르면 null
  returnTotal: number | null;   // 돌려보내면: 체험비 + 왕복 배송. 배송비 모르면 null
  purchaseWithoutShipping: number;
  returnWithoutShipping: number;
};

// param: price 상품가(원), hours 써보기 기간(시간), t 판매자 조건
// return: 기간별 예상 비용(24시간 = 1일, 올림)
export function computeTrialCost(price: number, hours: number, t: TrialTerms): TrialCost {
  const days = Math.max(1, Math.ceil(hours / 24));
  const optionFee = t.dailyFee * days;
  const purchaseCredit = round100((optionFee * t.purchaseCreditPct) / 100);
  const purchaseWithoutShipping = price + optionFee - purchaseCredit;
  const returnWithoutShipping = optionFee;
  const ship = t.shippingOneWay;
  return {
    hours, days, dailyFee: t.dailyFee, optionFee, purchaseCredit, shippingOneWay: ship,
    purchaseTotal: ship === null ? null : purchaseWithoutShipping + ship,
    returnTotal: ship === null ? null : returnWithoutShipping + ship * 2,
    purchaseWithoutShipping, returnWithoutShipping,
  };
}

// param: v 요청 본문의 trialTerms(unknown), price 상품가(원)
// return: 검증된 조건, 틀린 값이 있으면 오류 문구
export function parseTrialTerms(v: unknown, price: number): TrialTerms | string {
  if (!v || typeof v !== "object") return "써보기 조건을 입력해 주세요.";
  const o = v as Record<string, unknown>;
  const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
  const hours = Array.isArray(o.hours) ? [...new Set(o.hours)] : [];
  if (hours.length === 0 || !hours.every((h) => (TRIAL_HOURS as readonly unknown[]).includes(h))) return "써보기 기간을 하나 이상 골라 주세요.";
  if (!isInt(o.dailyFee) || o.dailyFee < 0 || o.dailyFee > Math.min(price, 1_000_000)) return "하루 체험비는 0원 이상, 상품 가격 이하로 입력하세요.";
  if (!isInt(o.purchaseCreditPct) || !CREDIT_OPTIONS.some((c) => c.pct === o.purchaseCreditPct)) return "사면 체험비를 돌려줄지 골라 주세요.";
  const ship = o.shippingOneWay === null || o.shippingOneWay === undefined || o.shippingOneWay === "" ? null : o.shippingOneWay;
  if (ship !== null && (!isInt(ship) || ship < 0 || ship > 200_000)) return "편도 배송비는 0~200,000원으로 입력하거나 비워 두세요.";
  const note = typeof o.conditionNote === "string" ? o.conditionNote.trim() : "";
  if (note.length > 100) return "추가 조건은 100자 이하로 적어 주세요.";
  return {
    hours: (hours as number[]).sort((a, b) => a - b),
    dailyFee: o.dailyFee,
    purchaseCreditPct: o.purchaseCreditPct,
    shippingOneWay: ship as number | null,
    conditionNote: note || null,
  };
}

// 구매자 제안: 기간 전체 체험비(원). 0원(무료로 써보게 해 달라)도 허용하고, 상품 가격을 넘을 수 없다.
// param: v 요청 본문, price 상품가. return: 검증된 제안 또는 오류 문구
export function parseProposal(v: unknown, price: number): { hours: number; offerFee: number; message: string | null } | string {
  if (!v || typeof v !== "object") return "제안 내용을 입력해 주세요.";
  const o = v as Record<string, unknown>;
  if (!(TRIAL_HOURS as readonly unknown[]).includes(o.hours)) return "써보기 기간을 골라 주세요.";
  if (typeof o.offerFee !== "number" || !Number.isInteger(o.offerFee) || o.offerFee < 0 || o.offerFee > price) return "제안 금액은 0원 이상, 상품 가격 이하로 입력하세요.";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  if (message.length > 200) return "한마디는 200자 이하로 적어 주세요.";
  return { hours: o.hours as number, offerFee: o.offerFee, message: message || null };
}
