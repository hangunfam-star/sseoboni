// 써보기 예상 비용 계산(검증용 가설). 마스터 기획 §7 기간(24/48/72시간), §8 비용(HYPOTHESIS·VALIDATE_FIRST), §52 비용 확인.
// 실제 결제·정산은 없다. 모든 값은 운영자 화면에서 바꿀 수 있고, 바뀔 때마다 version이 달라져 반응 기록과 함께 남는다.

export type TrialPricing = {
  version: string;           // 가격안 식별자(바뀔 때마다 새 값)
  hours: number[];           // 고를 수 있는 써보기 기간(시간)
  dailyRatePct: number;      // 하루 체험비 = 상품가 × 이 비율(%)
  dailyMin: number;          // 하루 체험비 최소(원)
  dailyMax: number;          // 하루 체험비 최대(원)
  shippingOneWay: number | null; // 편도 배송비 예상(원). null이면 "확정 전"으로 표시
  purchaseCreditPct: number; // 구매하면 체험비 중 돌려받는 비율(%). 0이면 체험비 그대로 부담
};

// 기본 가격안: §8 과거 예시(1일 2,000~4,000원, 고가 노트북 72시간 15,000~30,000원)에 맞춘 시작값.
// 배송비는 근거가 없어 "확정 전", 구매 시 상계는 OPEN DECISION이라 가장 보수적인 0%로 둔다.
export const DEFAULT_TRIAL_PRICING: TrialPricing = {
  version: "hypothesis-1",
  hours: [24, 48, 72],
  dailyRatePct: 0.7,
  dailyMin: 2000,
  dailyMax: 10000,
  shippingOneWay: null,
  purchaseCreditPct: 0,
};

export type TrialCost = {
  hours: number;
  days: number;
  dailyFee: number;
  optionFee: number;        // 체험비(기간 전체)
  purchaseCredit: number;   // 구매하면 돌려받는 체험비
  shippingOneWay: number | null;
  purchaseTotal: number | null; // 구매 시 최종(상품가 + 체험비 - 상계 + 편도 배송). 배송비 확정 전이면 null
  returnTotal: number | null;   // 반환 시 부담(체험비 + 왕복 배송). 배송비 확정 전이면 null
  purchaseWithoutShipping: number; // 배송비를 뺀 구매 시 금액
  returnWithoutShipping: number;   // 배송비를 뺀 반환 시 부담
};

const round100 = (v: number) => Math.round(v / 100) * 100;

// param: price 상품가(원), hours 써보기 기간(시간), p 가격안
// return: 기간별 예상 비용. 하루 체험비 = 상품가×비율을 최소~최대로 자르고 100원 단위 반올림, 기간은 24시간=1일로 올림
export function computeTrialCost(price: number, hours: number, p: TrialPricing): TrialCost {
  const days = Math.max(1, Math.ceil(hours / 24));
  const dailyFee = round100(Math.min(p.dailyMax, Math.max(p.dailyMin, (price * p.dailyRatePct) / 100)));
  const optionFee = dailyFee * days;
  const purchaseCredit = round100((optionFee * p.purchaseCreditPct) / 100);
  const purchaseWithoutShipping = price + optionFee - purchaseCredit;
  const returnWithoutShipping = optionFee;
  const ship = p.shippingOneWay;
  return {
    hours, days, dailyFee, optionFee, purchaseCredit, shippingOneWay: ship,
    purchaseTotal: ship === null ? null : purchaseWithoutShipping + ship,
    returnTotal: ship === null ? null : returnWithoutShipping + ship * 2,
    purchaseWithoutShipping, returnWithoutShipping,
  };
}

// param: v 저장된 값(unknown). return: 검증된 가격안, 틀린 값이 있으면 오류 문구
export function parseTrialPricing(v: unknown): TrialPricing | string {
  if (!v || typeof v !== "object") return "가격안 형식이 올바르지 않습니다.";
  const o = v as Record<string, unknown>;
  const int = (x: unknown, min: number, max: number) => (typeof x === "number" && Number.isInteger(x) && x >= min && x <= max ? x : null);
  const hours = Array.isArray(o.hours) ? [...new Set(o.hours.map((h) => int(h, 1, 24 * 14)))] : [];
  if (hours.length === 0 || hours.length > 5 || hours.some((h) => h === null)) return "기간은 1~336시간 정수로 1~5개 입력하세요.";
  const rate = typeof o.dailyRatePct === "number" && o.dailyRatePct >= 0 && o.dailyRatePct <= 10 ? o.dailyRatePct : null;
  if (rate === null) return "하루 비율은 0~10% 사이로 입력하세요.";
  const dmin = int(o.dailyMin, 0, 1_000_000);
  const dmax = int(o.dailyMax, 0, 1_000_000);
  if (dmin === null || dmax === null || dmin > dmax) return "하루 최소·최대 체험비를 0원 이상, 최소 ≤ 최대로 입력하세요.";
  const ship = o.shippingOneWay === null ? null : int(o.shippingOneWay, 0, 200_000);
  if (o.shippingOneWay !== null && ship === null) return "편도 배송비는 0~200,000원 정수로 입력하거나 비워 두세요.";
  const credit = int(o.purchaseCreditPct, 0, 100);
  if (credit === null) return "구매 시 돌려받는 비율은 0~100% 정수로 입력하세요.";
  const version = typeof o.version === "string" && o.version.length > 0 && o.version.length <= 40 ? o.version : null;
  if (!version) return "가격안 이름(version)이 필요합니다.";
  return { version, hours: (hours as number[]).sort((a, b) => a - b), dailyRatePct: rate, dailyMin: dmin, dailyMax: dmax, shippingOneWay: ship, purchaseCreditPct: credit };
}
