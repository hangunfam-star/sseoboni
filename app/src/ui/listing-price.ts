// 상품 가격 규칙(화면·서버 공통). 1,000원 미만은 등록·수정할 수 없다(사용자 결정 2026-10-09).
export const PRICE_MIN = 1_000;
export const PRICE_MAX = 100_000_000;

// param: raw 입력한 가격 문자열. return: 안내 문구, 비었거나 문제없으면 null
export function priceProblem(raw: string): string | null {
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < PRICE_MIN) return "1,000원 이상만 올릴 수 있어요.";
  if (n > PRICE_MAX) return "1억 원 이하로 입력하세요.";
  return null;
}
