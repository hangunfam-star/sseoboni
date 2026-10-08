const CONDITION_LABELS: Record<string, string> = {
  S: "S급",
  A: "A급",
  B: "B급",
  C: "C급",
};

export const CONDITION_GRADES = ["S", "A", "B", "C"] as const;

// 수요 숫자를 공개하는 최소 인원 (화면프로세스 §8 결정 3 권고값)
export const DEMAND_PUBLIC_MIN = 3;

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function conditionLabel(value: string): string {
  return CONDITION_LABELS[value] ?? "상태 확인 필요";
}

export function visualInitial(brand: string | null, modelName: string | null): string {
  const source = brand?.trim() || modelName?.trim();
  return source ? Array.from(source)[0].toUpperCase() : "상품";
}

// param: createdAt SQLite current_timestamp 문자열(UTC, "YYYY-MM-DD HH:MM:SS"), now 기준 시각
// return: "방금 전" / "N분 전" / "N시간 전" / "N일 전", 해석 불가 시 빈 문자열
export function relativeTime(createdAt: string, now: Date = new Date()): string {
  const t = Date.parse(createdAt.includes("T") ? createdAt : `${createdAt.replace(" ", "T")}Z`);
  if (Number.isNaN(t)) return "";
  const min = Math.floor((now.getTime() - t) / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / (60 * 24))}일 전`;
}

// param: count 중복 제거한 실제 인원. return: 기준 미만이면 숫자를 숨긴 문구, 0이면 null
export function demandLabel(count: number): string | null {
  if (count <= 0) return null;
  return count >= DEMAND_PUBLIC_MIN ? `찾는 사람 ${count}명` : "찾는 사람이 있어요";
}

// param: count '써보고 싶어요'를 누른 사람 수
// return: 3명 이상이면 숫자, 1~2명이면 숫자 없는 문구, 0명이면 null
export function tryWantLabel(count: number): string | null {
  if (count <= 0) return null;
  return count >= DEMAND_PUBLIC_MIN ? `써보고 싶은 사람 ${count}명` : "써보고 싶은 사람이 있어요";
}

// param: tryOk 판매자 최신 써보기 답(2 허용, 1 조건부, 0 거절·미답)
// return: 카드 표시 문구. 써보기는 아직 열리지 않았으므로 "준비 중"을 함께 밝힌다. 표시할 게 없으면 null
export function tryBadgeLabel(tryOk: number): string | null {
  if (tryOk >= 2) return "써보기 허용 · 준비 중";
  if (tryOk === 1) return "조건부 써보기 · 준비 중";
  return null;
}

export type IllustrationKind = "laptop" | "tablet" | "audio" | "camera" | "generic";

// param: 카테고리·모델 이름. return: 사진이 없을 때 쓰는 모델 일러스트 종류
export function illustrationKind(categoryName: string | null, modelName: string | null): IllustrationKind {
  const s = `${categoryName ?? ""} ${modelName ?? ""}`.toLowerCase();
  if (/노트북|laptop|macbook|gram|그램/.test(s)) return "laptop";
  if (/태블릿|tablet|ipad|아이패드|갤럭시 탭/.test(s)) return "tablet";
  if (/음향|헤드폰|이어폰|airpods|headphone|스피커/.test(s)) return "audio";
  if (/카메라|camera|미러리스/.test(s)) return "camera";
  return "generic";
}
