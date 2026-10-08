// 의견 보내기(이탈 사유·인터뷰) 선택지. 화면과 서버가 같은 목록을 쓴다.
export const FEEDBACK_REASONS = [
  "써보기가 아직 안 열려서",
  "원하는 상품이 없어서",
  "가격이 안 맞아서",
  "중고라 믿기 어려워서",
  "그냥 둘러보는 중이에요",
  "기타",
] as const;

export const TRY_LATER = ["써볼래요", "모르겠어요", "안 써볼래요"] as const;

export const FEEDBACK_MESSAGE_MAX = 1000;
export const FEEDBACK_DAILY_MAX = 10;
