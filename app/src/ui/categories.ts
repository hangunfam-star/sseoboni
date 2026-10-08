// 판매 등록에서 "직접 입력"할 때 고르는 상품 종류. 서버는 이 목록에 있는 이름만 받는다.
// 목록에 없는 종류가 DB에 없으면 등록 시점에 categories에 새로 만든다.
export const SELL_CATEGORIES = [
  "노트북",
  "태블릿",
  "스마트폰",
  "오디오",
  "카메라",
  "게임기",
  "키보드·주변기기",
  "생활가전",
  "기타",
] as const;

export type SellCategory = (typeof SELL_CATEGORIES)[number];

export function isSellCategory(v: string): v is SellCategory {
  return (SELL_CATEGORIES as readonly string[]).includes(v);
}
