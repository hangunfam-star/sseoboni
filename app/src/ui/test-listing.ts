// 시험용 상품(운영자가 화면 시험용으로 올린 것). listings.is_test로 표시하고, 신청·제안·의향 버튼을 막는다.
// 화면에는 작은 "시험용" 표시 하나만 보인다(사용자 결정 2026-10-15). 예전 방식(제목 앞 "[시험용]")도 같이 막는다.
export const TEST_LISTING_PREFIX = "[시험용]";

// param: l 상품(isTest 열·제목). return: 시험용 상품이면 true
export function isTestListing(l: { isTest?: boolean | null; title?: string | null } | null | undefined): boolean {
  if (!l) return false;
  return Boolean(l.isTest) || (typeof l.title === "string" && l.title.trim().startsWith(TEST_LISTING_PREFIX));
}

export const TEST_LISTING_BADGE = "시험용";
export const TEST_LISTING_MESSAGE = "시험용 상품이라 실제로 판매하지 않아요.";
