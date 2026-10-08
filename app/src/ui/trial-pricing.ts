// 써보기 비용 계산. 구간별 체험비는 판매자가 상품 등록·수정 때 정한다(listing_trial_terms).
// 정책(사용자 결정 2026-10-08)
// - 구매자는 상품 가격을 미리 결제한다.
// - 써보고 사면 체험비 0원, 구매자는 상품 가격만 낸다. 수수료(미리 결제 금액의 %)는 판매자 입금액에서 뺀다(10만원 → 판매자 97,000원).
// - 돌려보내면 구매자 환불금에서 체험비 + 수수료를 뺀다. 판매자는 체험비를 받는다.
// - 정한 구간을 넘기면 다음 구간 요금(예: 24시간 구간에서 25시간째 → 48시간 요금). 가장 긴 구간을 넘기면 구매로 처리.
// - 수수료는 기본 3%, 운영자가 정한 기간에는 0% 등으로 바꿀 수 있다(platform-fee).
// 결제·정산은 아직 없다(PG 불가 → 통장 방식 추후). 화면에는 "예상 금액"으로만 보여 준다.
// 추후: 써보기 연장 = 다음 구간으로 옮기고 차액을 받는 방식으로 붙일 수 있게 구간 단위로 계산한다.

export const TRIAL_HOURS = [24, 48, 72] as const; // 마스터 기획 §7 초기 검증 기간

export type TrialTier = { hours: number; fee: number };

export type TrialTerms = {
  tiers: TrialTier[];            // 구간별 체험비(짧은 순)
  shippingOneWay: number | null; // 편도 배송비 예상(원), 모르면 null
  conditionNote: string | null;  // 추가 조건 메모
};

const round100 = (v: number) => Math.round(v / 100) * 100;

// param: price 상품가(원)
// return: 추천 하루 체험비(상품가 0.7%를 2,000~10,000원으로 자르고 100원 단위, §8 과거 예시 기준, 참고용)
export function recommendDailyFee(price: number): number {
  return round100(Math.min(10000, Math.max(2000, price * 0.007)));
}

// param: price 상품가, hours 구간. return: 추천 구간 체험비(하루 추천 × 일수)
export function recommendTierFee(price: number, hours: number): number {
  return recommendDailyFee(price) * Math.max(1, Math.ceil(hours / 24));
}

// param: actualHours 실제 쓴 시간, tiers 판매자 구간
// return: 적용 구간(쓴 시간 이상인 가장 짧은 구간). 가장 긴 구간을 넘기면 null(구매로 처리)
export function tierForHours(actualHours: number, tiers: TrialTier[]): TrialTier | null {
  return [...tiers].sort((a, b) => a.hours - b.hours).find((t) => actualHours <= t.hours) ?? null;
}

// param: prepaid 미리 결제한 금액(원), feePct 수수료율(%, 0.1% 단위). return: 수수료(원)
// 0.1% 단위 정수로 바꿔 계산해 소수 오차를 없애고, 1원 미만은 반올림한다(원 단위 처리 방식은 정산 정책 확정 전 임시).
export function platformFee(prepaid: number, feePct: number): number {
  const permille = Math.round(feePct * 10);
  return Math.floor((prepaid * permille + 500) / 1000);
}

export type TrialCost = {
  hours: number;
  tierFee: number;               // 이 구간 체험비 — 돌려보낼 때만
  feePct: number;
  fee: number;                   // 수수료(사면 판매자 부담, 돌려보내면 구매자 부담)
  shippingOneWay: number | null;
  prepaid: number;               // 미리 결제(상품 가격)
  purchaseTotal: number;         // 사면 구매자가 내는 금액 = 상품 가격(체험비 0원, 배송은 별도 표시)
  sellerPayoutOnPurchase: number; // 사면 판매자 입금 = 상품 가격 − 수수료
  returnCharge: number;          // 돌려보내면 구매자가 내는 금액 = 체험비 + 수수료(왕복 배송은 별도 표시)
  refund: number;                // 돌려보내면 구매자 환불 = 미리 결제 − 체험비 − 수수료
  sellerPayoutOnReturn: number;  // 돌려보내면 판매자 입금 = 체험비
  valid: boolean;                // 체험비 + 수수료 ≤ 미리 결제 (아니면 금액을 보여 주지 않는다)
};

// param: price 상품가(원), hours 판매자가 정한 구간 중 하나(시간), t 판매자 조건, feePct 지금 수수료율(%)
// return: 그 구간을 골랐을 때의 예상 금액. 배송비는 따로 표시한다. 정한 구간이 아니면 예외.
// 실제 사용 시간에 따른 정산(초과 시 다음 구간, 최장 초과 시 구매)은 tierForHours로 하며, 써보기 거래가 열릴 때 서버 시각 기준으로 붙인다.
export function computeTrialCost(price: number, hours: number, t: TrialTerms, feePct: number): TrialCost {
  const tier = t.tiers.find((x) => x.hours === hours);
  if (!tier) throw new Error(`판매자가 정하지 않은 써보기 기간: ${hours}`);
  const fee = platformFee(price, feePct);
  return {
    hours: tier.hours, tierFee: tier.fee, feePct, fee, shippingOneWay: t.shippingOneWay, prepaid: price,
    purchaseTotal: price,
    sellerPayoutOnPurchase: Math.max(0, price - fee),
    returnCharge: tier.fee + fee,
    refund: price - tier.fee - fee,
    sellerPayoutOnReturn: tier.fee,
    valid: tier.fee + fee <= price,
  };
}

// param: v 요청 본문의 trialTerms(unknown), price 상품가(원), feePct 지금 수수료율(%)
// return: 검증된 조건, 틀린 값이 있으면 오류 문구. 구간은 24/48/72 중, 긴 구간 체험비가 짧은 구간보다 적을 수 없고,
//         가장 비싼 체험비 + 수수료가 상품 가격을 넘을 수 없다(돌려보낼 때 환불금이 음수가 되지 않게).
export function parseTrialTerms(v: unknown, price: number, feePct = 3): TrialTerms | string {
  if (!v || typeof v !== "object") return "써보기 조건을 입력해 주세요.";
  const o = v as Record<string, unknown>;
  const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
  const raw = Array.isArray(o.tiers) ? o.tiers : [];
  const tiers: TrialTier[] = [];
  for (const r of raw) {
    const x = (r ?? {}) as Record<string, unknown>;
    if (!(TRIAL_HOURS as readonly unknown[]).includes(x.hours) || tiers.some((t) => t.hours === x.hours)) return "써보기 기간을 다시 골라 주세요.";
    if (!isInt(x.fee) || x.fee < 0 || x.fee > Math.min(price, 1_000_000)) return `${x.hours}시간 체험비는 0원 이상, 상품 가격 이하로 입력하세요.`;
    tiers.push({ hours: x.hours as number, fee: x.fee });
  }
  if (tiers.length === 0) return "써보기 기간을 하나 이상 골라 주세요.";
  tiers.sort((a, b) => a.hours - b.hours);
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].fee < tiers[i - 1].fee) return `${tiers[i].hours}시간 체험비는 ${tiers[i - 1].hours}시간 체험비보다 적을 수 없어요.`;
  }
  const maxFee = Math.max(...tiers.map((t) => t.fee));
  if (maxFee + platformFee(price, feePct) > price) return `체험비와 수수료(${feePct}%)를 합한 금액이 상품 가격을 넘을 수 없어요. 체험비를 ${Math.max(0, price - platformFee(price, feePct)).toLocaleString("ko-KR")}원 이하로 정해 주세요.`;
  const ship = o.shippingOneWay === null || o.shippingOneWay === undefined || o.shippingOneWay === "" ? null : o.shippingOneWay;
  if (ship !== null && (!isInt(ship) || ship < 0 || ship > 200_000)) return "편도 배송비는 0~200,000원으로 입력하거나 비워 두세요.";
  const note = typeof o.conditionNote === "string" ? o.conditionNote.trim() : "";
  if (note.length > 100) return "추가 조건은 100자 이하로 적어 주세요.";
  const contact = findContactInfo(note);
  if (contact) return `추가 조건에 ${contact}는 적을 수 없어요.`;
  return { tiers, shippingOneWay: ship as number | null, conditionNote: note || null };
}

// 구매자 제안: 고른 구간의 체험비(돌려보낼 때 낼 금액, 원). 0원도 허용, 상품 가격을 넘을 수 없다.
// param: v 요청 본문, price 상품가. return: 검증된 제안 또는 오류 문구
export function parseProposal(v: unknown, price: number): { hours: number; offerFee: number; message: string | null } | string {
  if (!v || typeof v !== "object") return "제안 내용을 입력해 주세요.";
  const o = v as Record<string, unknown>;
  if (!(TRIAL_HOURS as readonly unknown[]).includes(o.hours)) return "써보기 기간을 골라 주세요.";
  if (typeof o.offerFee !== "number" || !Number.isInteger(o.offerFee) || o.offerFee < 0 || o.offerFee > price) return "제안 금액은 0원 이상, 상품 가격 이하로 입력하세요.";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  if (message.length > 200) return "한마디는 200자 이하로 적어 주세요.";
  const contact = findContactInfo(message);
  if (contact) return `한마디에 ${contact}는 적을 수 없어요.`;
  return { hours: o.hours as number, offerFee: o.offerFee, message: message || null };
}

// 사용자끼리 주고받는 글에 연락처·계좌가 섞이지 않게 막는다(직거래 유도·개인정보 노출 방지).
// param: text 검사할 글. return: 발견한 종류 이름(전화번호·이메일·메신저 아이디·계좌번호), 없으면 null
export function findContactInfo(text: string): string | null {
  // 전각·호환 문자 통일, 보이지 않는 문자 제거
  const t = text.normalize("NFKC").replace(/[\u200B-\u200F\u2060-\u2064\uFEFF\u00AD\u034F\u180E\u115F\u1160\u3164\uFFA0]/g, "");
  // 숫자 사이 공백·점·하이픈·괄호 등 구분자를 지운 문자열(01 0-12 34. 5678 같은 우회 대응)
  const digitsJoined = t.replace(/(?<=\d)[\s.\-·_/()]+(?=\d)/g, "");
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t) || /[\w.+-]+\s*(골뱅이|\(at\)|\[at\])\s*[\w-]+/i.test(t) || /(지메일|gmail|네이버\s*메일|naver\.com|daum\.net|hanmail|닷\s*컴|점\s*컴|dot\s*com)/i.test(t)) return "이메일";
  if (/(카톡|카카오톡|kakao|오픈\s*채팅|open\.kakao|텔레그램|telegram|t\.me\/|라인\s*아이디|line\s*id|인스타|instagram)/i.test(t)) return "메신저 아이디";
  if (/(01[016789]|0\d{1,2})\d{3,4}\d{4}/.test(digitsJoined) || /(공일공|영일영)/.test(t)) return "전화번호";
  if (/(계좌|입금|송금)/.test(t) || /\d{10,}/.test(digitsJoined)) return "계좌번호";
  return null;
}
