import { test } from "node:test";
import assert from "node:assert/strict";
import { checkItemsFor, componentChecks, needsReset, parseCheckAnswers, readCheckAnswers } from "./check-items";

test("종류별 점검 항목, 없는 종류는 공통 항목", () => {
  assert.equal(checkItemsFor("노트북").length, 6);
  assert.equal(checkItemsFor("없는종류")[0].key, "run");
  assert.equal(checkItemsFor(null).length, 3);
});

test("써보기 상품은 모든 항목 필수, 아니면 채운 것만", () => {
  assert.match(parseCheckAnswers({}, "오디오", true) as string, /점검표를 모두/);
  assert.deepEqual(parseCheckAnswers({}, "오디오", false), []);
  const ok = parseCheckAnswers({ sound: "양쪽 정상", anc: "기능 없음", battery: "보통", pad: "깨끗함" }, "오디오", true);
  assert.ok(Array.isArray(ok) && ok.length === 4);
});

test("선택값이 아니면 거절, 적는 항목은 30자까지", () => {
  assert.match(parseCheckAnswers({ sound: "아주 좋음" }, "오디오", false) as string, /다시 골라/);
  assert.match(parseCheckAnswers({ size: "가".repeat(31) }, "신발", false) as string, /30자/);
  assert.deepEqual(parseCheckAnswers({ size: " 270mm " }, "신발", false), [{ key: "size", label: "실측 사이즈", value: "270mm" }]);
});

test("반송 전 초기화가 필요한 품목", () => {
  assert.equal(needsReset("노트북"), true);
  assert.equal(needsReset("의류"), false);
  assert.equal(needsReset(null), false);
});

test("구성품 확인은 true만 인정, 깨진 점검표는 빈 목록", () => {
  assert.deepEqual(componentChecks(["본체", "충전기"], { 본체: true, 충전기: "yes" }), [{ name: "본체", ok: true }, { name: "충전기", ok: false }]);
  assert.deepEqual(readCheckAnswers("{깨짐"), []);
  assert.deepEqual(readCheckAnswers(null), []);
});
