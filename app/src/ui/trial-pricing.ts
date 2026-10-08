// 써보기 비용 계산. 금액 조건은 판매자가 상품 등록·수정 때 정한다(listing_trial_terms).
// 정책(사용자 결정 2026-10-08): 써보고 사면 체험비 0원, 사지 않고 돌려보내면 체험비를 낸다.
// 결제·정산은 아직 없다(PG 불가 → 통장 방식 추후). 구매자에게는 판매자 조건으로 계산한 "예상 금액"만 보여 준다.

export const TRIAL_HOURS = [24, 48, 72] as const; // 마스터 기획 §7 초기 검증 기간

export type TrialTerms = {
  hours: number[];               // 고를 수 있는 기간(시간)
  dailyFee: number;              // 하루 체험비(원) — 돌려보낼 때만 낸다
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
  optionFee: number;        // 체험비(기간 전체) — 돌려보낼 때만
  shippingOneWay: number | null;
  purchaseTotal: number | null; // 사면: 상품가 + 편도 배송(체험비 0원). 배송비 모르면 null
  returnTotal: number | null;   // 돌려보내면: 체험비 + 왕복 배송. 배송비 모르면 null
  purchaseWithoutShipping: number;
  returnWithoutShipping: number;
};

// param: price 상품가(원), hours 써보기 기간(시간), t 판매자 조건
// return: 기간별 예상 비용(24시간 = 1일, 올림)
export function computeTrialCost(price: number, hours: number, t: TrialTerms): TrialCost {
  const days = Math.max(1, Math.ceil(hours / 24));
  const optionFee = t.dailyFee * days;
  const ship = t.shippingOneWay;
  return {
    hours, days, dailyFee: t.dailyFee, optionFee, shippingOneWay: ship,
    purchaseTotal: ship === null ? null : price + ship,
    returnTotal: ship === null ? null : optionFee + ship * 2,
    purchaseWithoutShipping: price,
    returnWithoutShipping: optionFee,
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
  const ship = o.shippingOneWay === null || o.shippingOneWay === undefined || o.shippingOneWay === "" ? null : o.shippingOneWay;
  if (ship !== null && (!isInt(ship) || ship < 0 || ship > 200_000)) return "편도 배송비는 0~200,000원으로 입력하거나 비워 두세요.";
  const note = typeof o.conditionNote === "string" ? o.conditionNote.trim() : "";
  if (note.length > 100) return "추가 조건은 100자 이하로 적어 주세요.";
  const contact = findContactInfo(note);
  if (contact) return `추가 조건에 ${contact}는 적을 수 없어요.`;
  return { hours: (hours as number[]).sort((a, b) => a - b), dailyFee: o.dailyFee, shippingOneWay: ship as number | null, conditionNote: note || null };
}

// 구매자 제안: 기간 전체 체험비(돌려보낼 때 낼 금액, 원). 0원도 허용, 상품 가격을 넘을 수 없다.
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
  const t = text.normalize("NFKC");
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t)) return "이메일";
  if (/(카톡|카카오톡|kakao|오픈\s*채팅|open\.kakao|텔레그램|telegram|t\.me\/|라인\s*아이디|line\s*id|인스타|instagram)/i.test(t)) return "메신저 아이디";
  if (/(01[016789]|0\d{1,2})[\s.-]?\d{3,4}[\s.-]?\d{4}/.test(t)) return "전화번호";
  if (/(계좌|입금|송금)/.test(t) || /\d[\d\s-]{9,}\d/.test(t)) return "계좌번호";
  return null;
}
