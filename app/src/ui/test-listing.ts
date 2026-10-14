// 시험용 상품(운영자가 화면 시험용으로 올린 것). 제목이 이 글자로 시작하면 신청·제안·의향 버튼을 막는다.
export const TEST_LISTING_PREFIX = "[시험용]";

// param: title 상품 제목. return: 시험용 상품이면 true
export function isTestListing(title: string | null | undefined): boolean {
  return typeof title === "string" && title.trim().startsWith(TEST_LISTING_PREFIX);
}

export const TEST_LISTING_MESSAGE = "시험용 상품이라 실제로 판매하지 않아요. 신청·입금하지 마세요.";
