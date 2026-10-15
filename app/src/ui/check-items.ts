// 상품 점검표(판매자가 등록할 때 채움)와 거래 단계별 확인(받을 때·보내기 전·검수) 규칙. 순수 함수라 시험 가능.
// 사용자 결정 2026-10-15: 등록 점검표, 받을 때 확인, 반송 전 확인, 판매자 검수 강화(차감 규칙은 별도 정책 결정 전까지 없음).

export type CheckItem = { key: string; label: string; options?: string[]; placeholder?: string };
export type CheckAnswer = { key: string; label: string; value: string };

const BATTERY = { key: "battery", label: "배터리 성능", options: ["90% 이상", "80~89%", "79% 이하", "확인 어려움"] };
const SCREEN = { key: "screen", label: "화면", options: ["불량 없음", "잔상·불량화소 있음", "줄·깨짐 있음"] };
const CHARGE = { key: "charge", label: "충전", options: ["정상", "이상 있음"] };
const LOOK = { key: "look", label: "외관", options: ["흠집 거의 없음", "작은 흠집 있음", "눈에 띄는 흠집·찍힘"] };
const RESET = { key: "reset", label: "초기화", options: ["보내기 전에 초기화해요", "이미 초기화했어요"] };
const DIRT = { key: "dirt", label: "오염·냄새", options: ["없음", "조금 있음", "있음"] };

const ITEMS: Record<string, CheckItem[]> = {
  노트북: [BATTERY, SCREEN, { key: "keys", label: "키보드·트랙패드", options: ["모두 정상", "일부 키 이상"] }, CHARGE, LOOK, RESET],
  태블릿: [BATTERY, SCREEN, { key: "touch", label: "터치·펜", options: ["정상", "일부 이상"] }, CHARGE, LOOK, RESET],
  스마트폰: [BATTERY, SCREEN, { key: "camera", label: "카메라", options: ["정상", "이상 있음"] }, { key: "call", label: "통화·충전", options: ["정상", "이상 있음"] }, LOOK, RESET],
  오디오: [
    { key: "sound", label: "소리", options: ["양쪽 정상", "한쪽 이상"] },
    { key: "anc", label: "노이즈 캔슬링", options: ["정상", "이상 있음", "기능 없음"] },
    { key: "battery", label: "배터리", options: ["오래감", "보통", "빨리 닳음"] },
    { key: "pad", label: "이어패드·외관", options: ["깨끗함", "사용감 있음", "해짐·찢어짐"] },
  ],
  카메라: [
    { key: "shutter", label: "셔터·촬영", options: ["정상", "이상 있음"] },
    { key: "sensor", label: "센서·렌즈", options: ["깨끗함", "먼지·곰팡이 있음"] },
    { key: "battery", label: "배터리", options: ["오래감", "보통", "빨리 닳음"] }, LOOK,
  ],
  게임기: [
    { key: "run", label: "구동", options: ["정상", "이상 있음"] },
    { key: "pad", label: "컨트롤러", options: ["정상", "쏠림·이상 있음"] }, LOOK, RESET,
  ],
  생활가전: [
    { key: "run", label: "작동", options: ["정상", "일부 이상"] },
    { key: "noise", label: "소음", options: ["조용함", "보통", "큼"] }, LOOK,
    { key: "parts", label: "소모품·필터", options: ["새것·깨끗함", "사용감 있음", "교체 필요"] },
  ],
  신발: [
    { key: "size", label: "실측 사이즈", placeholder: "예: 270mm" },
    { key: "sole", label: "밑창 마모", options: ["거의 없음", "보통", "많음"] }, DIRT, LOOK,
  ],
  의류: [
    { key: "size", label: "실측", placeholder: "예: 가슴단면 55cm, 총장 70cm" },
    { key: "pill", label: "보풀·늘어남", options: ["없음", "조금 있음", "있음"] }, DIRT,
    { key: "wash", label: "세탁", options: ["세탁해서 보내요", "세탁 안 해요"] },
  ],
};
const COMMON: CheckItem[] = [{ key: "run", label: "작동·사용 상태", options: ["정상", "일부 이상"] }, LOOK, DIRT];

// 반송 전에 초기화·로그아웃을 꼭 확인할 품목(계정이 남으면 판매자가 쓸 수 없음)
const RESET_CATEGORIES = ["노트북", "태블릿", "스마트폰", "게임기"];

// param: category 상품 종류 이름. return: 그 종류의 점검 항목
export const checkItemsFor = (category: string | null | undefined): CheckItem[] => (category && ITEMS[category]) || COMMON;
// param: category. return: 반송 전 초기화 확인이 필요한지
export const needsReset = (category: string | null | undefined): boolean => Boolean(category && RESET_CATEGORIES.includes(category));

// param: v 요청 값({key: value}), category, required 써보기 상품이면 모든 항목 필수. return: 저장할 답 목록 또는 오류 문구
export function parseCheckAnswers(v: unknown, category: string | null | undefined, required: boolean): CheckAnswer[] | string {
  const items = checkItemsFor(category);
  const raw = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out: CheckAnswer[] = [];
  for (const it of items) {
    const val = typeof raw[it.key] === "string" ? (raw[it.key] as string).trim() : "";
    if (!val) {
      if (required) return `써보기 상품은 점검표를 모두 채워야 해요: ${it.label}`;
      continue;
    }
    if (it.options && !it.options.includes(val)) return `점검표 '${it.label}' 값을 다시 골라 주세요.`;
    if (!it.options && val.length > 30) return `점검표 '${it.label}'는 30자 이하로 적어 주세요.`;
    out.push({ key: it.key, label: it.label, value: val });
  }
  return out;
}

// param: s 저장된 JSON. return: 점검 답 목록(깨졌으면 빈 목록)
export function readCheckAnswers(s: string | null | undefined): CheckAnswer[] {
  if (!s) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x) => x && typeof x.label === "string" && typeof x.value === "string") : [];
  } catch { return []; }
}

// ── 거래 단계별 확인 ──
export type ArrivalCheck = { items: { name: string; ok: boolean }[]; matches: boolean; note: string; photos: string[]; late?: boolean }; // late: 자동 받음 뒤 늦게 올린 확인
// 자동 받음(구매자 확인 없이 받은 것으로 처리) 뒤 구매자가 받은 물건 확인을 늦게 올릴 수 있는 시간(사용자 결정 2026-10-15, A안)
export const LATE_ARRIVAL_HOURS = 24;
export type PackCheck = { items: { name: string; ok: boolean }[]; reset: boolean | null; note: string; photos: string[] };
export const INSPECT_CONDITIONS = [
  { key: "SAME", label: "보낼 때와 같아요" },
  { key: "DAMAGED", label: "새 흠집·손상이 있어요" },
  { key: "BROKEN", label: "작동에 이상이 있어요" },
] as const;
export type InspectCondition = (typeof INSPECT_CONDITIONS)[number]["key"];
export const inspectConditionLabel = (k: string | null | undefined) => INSPECT_CONDITIONS.find((c) => c.key === k)?.label ?? null;

export const ORDER_PHOTO_STAGES = ["RECEIVE", "PACK", "INSPECT"] as const;
export type OrderPhotoStage = (typeof ORDER_PHOTO_STAGES)[number];
export const ORDER_PHOTO_MAX = 5;

// param: components 약속된 구성품, v 요청 값({이름: true}). return: 구성품별 확인 결과
export function componentChecks(components: string[], v: unknown): { name: string; ok: boolean }[] {
  const raw = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return components.map((name) => ({ name, ok: raw[name] === true }));
}
