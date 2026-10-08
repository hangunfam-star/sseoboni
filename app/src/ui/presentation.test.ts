import test from "node:test";
import assert from "node:assert/strict";
import { conditionLabel, demandLabel, formatWon, illustrationKind, relativeTime, tryBadgeLabel, tryWantLabel, visualInitial } from "./presentation";

test("가격과 상태를 사용자 문구로 변환한다", () => {
  assert.equal(formatWon(1290000), "1,290,000원");
  assert.equal(conditionLabel("A"), "A급");
  assert.equal(conditionLabel("unknown"), "상태 확인 필요");
});

test("사진 없는 상품에는 실제 브랜드 첫 글자만 사용한다", () => {
  assert.equal(visualInitial("Apple", "MacBook Air"), "A");
  assert.equal(visualInitial("", "MacBook Air"), "M");
  assert.equal(visualInitial("", ""), "상품");
});

test("긴 제목과 큰 가격도 문자열 손실 없이 표시 규칙을 통과한다", () => {
  const title = "매우 긴 한글 상품명 ".repeat(10).trim();
  assert.equal(title.length > 60, true);
  assert.equal(formatWon(100000000), "100,000,000원");
});

test("등록 시각을 상대 시간으로 바꾼다 (SQLite UTC 문자열)", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  assert.equal(relativeTime("2026-09-30 11:59:40", now), "방금 전");
  assert.equal(relativeTime("2026-09-30 11:45:00", now), "15분 전");
  assert.equal(relativeTime("2026-09-30 09:00:00", now), "3시간 전");
  assert.equal(relativeTime("2026-09-27 12:00:00", now), "3일 전");
  assert.equal(relativeTime("잘못된 값", now), "");
});

test("수요 숫자는 3명 이상일 때만 공개한다", () => {
  assert.equal(demandLabel(0), null);
  assert.equal(demandLabel(2), "찾는 사람이 있어요");
  assert.equal(demandLabel(3), "찾는 사람 3명");
});

test("사진이 없으면 카테고리·모델로 일러스트를 고른다", () => {
  assert.equal(illustrationKind("노트북", "MacBook Air M2"), "laptop");
  assert.equal(illustrationKind(null, "iPad Air"), "tablet");
  assert.equal(illustrationKind("기타", "무언가"), "generic");
});

test("써보고 싶은 사람 수도 3명 이상일 때만 숫자로 보여 준다", () => {
  assert.equal(tryWantLabel(0), null);
  assert.equal(tryWantLabel(2), "써보고 싶은 사람이 있어요");
  assert.equal(tryWantLabel(3), "써보고 싶은 사람 3명");
});

test("카드 써보기 표시는 허용·조건부를 구분하고 준비 중임을 밝힌다", () => {
  assert.equal(tryBadgeLabel(0), null);
  assert.equal(tryBadgeLabel(1), "조건부 써보기 · 준비 중");
  assert.equal(tryBadgeLabel(2), "써보기 허용 · 준비 중");
});
