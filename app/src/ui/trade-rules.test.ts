import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TRADE_SETTINGS, allowedActions, chipsFor, depositNameFor, gradeOf, median, moneyOf, parseBankAccount, parseQuestions,
  parseShipTo, parseTradeSettings, purchaseFees, ratioText, returnFeeFor, shipInputProblem,
} from "./trade-rules";

const tiers = [{ hours: 24, fee: 1000 }, { hours: 48, fee: 2000 }, { hours: 72, fee: 3000 }];

test("구매 확정: 체험료 0원, 추가 결제 없음 / 반납: 상품가 − 체험료(발송비 환불 없음)", () => {
  const m = moneyOf(100_000, 3_000, 2_000);
  assert.equal(m.payTotal, 103_000);
  assert.equal(m.buyExtra, 0);
  assert.equal(m.returnCharge, 2_000);
  assert.equal(m.refundIfReturn, 98_000);
  assert.equal(moneyOf(1_000, 0, 5_000).refundIfReturn, 0); // 음수 환불 없음
  assert.equal(moneyOf(50_000, 0, null).returnCharge, 0);    // 바로 구매
});

test("반납 체험료: 고른 구간 안이면 그 요금, 넘기면 다음 구간, 가장 긴 구간도 넘기면 가장 긴 요금", () => {
  assert.equal(returnFeeFor(tiers, 24, 10), 1000);
  assert.equal(returnFeeFor(tiers, 24, 24), 1000);
  assert.equal(returnFeeFor(tiers, 24, 25), 2000);
  assert.equal(returnFeeFor(tiers, 48, 30), 2000);
  assert.equal(returnFeeFor(tiers, 48, 49), 3000);
  assert.equal(returnFeeFor(tiers, 72, 100), 3000);
});

test("수수료는 구매 완료 건 판매가 기준, 베타 0%면 0원이고 정식(3%) 금액은 기록용", () => {
  assert.deepEqual(purchaseFees(100_000, 0, 3), { feeAmount: 0, virtualFee: 3000 });
  assert.deepEqual(purchaseFees(100_000, 3, 3), { feeAmount: 3000, virtualFee: 3000 });
});

test("역할·상태별 행동: 반납 신청만으로 완료되지 않고, 분쟁 중에는 금액 확정 행동을 막는다", () => {
  assert.deepEqual(allowedActions("TRIAL", "AWAIT_PAYMENT", "seller", false), ["CONFIRM_PAYMENT", "CANCEL"]);
  assert.deepEqual(allowedActions("TRIAL", "AWAIT_PAYMENT", "buyer", false), ["CANCEL"]);
  assert.deepEqual(allowedActions("TRIAL", "TRIAL", "buyer", false), ["EXTEND", "PURCHASE", "RETURN"]);
  assert.deepEqual(allowedActions("TRIAL", "TRIAL", "seller", false), []);
  assert.deepEqual(allowedActions("TRIAL", "RETURN_REQUESTED", "buyer", false), ["RETURN_SHIPPED"]);
  assert.deepEqual(allowedActions("TRIAL", "RETURN_SHIPPED", "seller", false), ["INSPECT"]);
  assert.deepEqual(allowedActions("TRIAL", "REFUND_SENT", "buyer", false), ["REFUND_RECEIVED"]);
  assert.deepEqual(allowedActions("BUY", "RECEIVED", "buyer", false), ["PURCHASE"]);
  assert.deepEqual(allowedActions("TRIAL", "RECEIVED", "buyer", false), []);
  assert.deepEqual(allowedActions("TRIAL", "RETURN_SHIPPED", "seller", true), []);
  assert.deepEqual(allowedActions("TRIAL", "REFUND_DUE", "seller", true), []);
  assert.deepEqual(allowedActions("TRIAL", "PAID", "seller", true), ["SHIP"]);
  for (const s of ["PURCHASED", "RETURNED", "CANCELLED"] as const) {
    assert.deepEqual(allowedActions("TRIAL", s, "buyer", false), []);
    assert.deepEqual(allowedActions("TRIAL", s, "seller", false), []);
  }
});

test("활동 등급: 써린이 → 써본이 → 써잘알 → 써고수 → 써신", () => {
  assert.equal(gradeOf(0).name, "써린이");
  assert.equal(gradeOf(2).toNext, 1);
  assert.equal(gradeOf(3).name, "써본이");
  assert.equal(gradeOf(10).name, "써잘알");
  assert.equal(gradeOf(30).name, "써고수");
  assert.equal(gradeOf(100).name, "써신");
  assert.equal(gradeOf(100).toNext, null);
});

test("통계: 중앙값, 기록이 없으면 0%가 아니라 '기록 없음'", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3);
  assert.equal(ratioText(0, 0), "기록 없음");
  assert.equal(ratioText(9, 10), "9/10회");
});

test("입력 검증: 계좌·배송지·송장·질문", () => {
  assert.equal(typeof parseBankAccount({ bank: "토스뱅크", account: "1002-7263-2354", holder: "빅플래닛" }), "object");
  assert.equal(typeof parseBankAccount({ bank: "없는은행", account: "1002726323544", holder: "홍길동" }), "string");
  assert.equal(typeof parseBankAccount({ bank: "국민", account: "123", holder: "홍길동" }), "string");
  assert.equal(typeof parseShipTo({ name: "홍길동", phone: "010-1234-5678", address: "서울시 강남구 테헤란로 1, 101호" }), "object");
  assert.equal(typeof parseShipTo({ name: "홍", phone: "010-1234-5678", address: "서울시 강남구 테헤란로 1" }), "string");
  assert.equal(typeof parseShipTo({ name: "홍길동", phone: "02-123-4567", address: "서울시 강남구 테헤란로 1" }), "string");
  assert.equal(shipInputProblem("CJ대한통운", "123456789012"), null);
  assert.notEqual(shipInputProblem("모르는택배", "123456789012"), null);
  assert.notEqual(shipInputProblem("CJ대한통운", "12"), null);
  assert.deepEqual(parseQuestions(["무게", " 소음 ", "무게"]), ["무게", "소음"]);
  assert.equal(typeof parseQuestions(["a", "b", "c", "d"]), "string");
});

test("설정: 기본은 거래 닫힘, 잘못된 값은 거부", () => {
  assert.equal(DEFAULT_TRADE_SETTINGS.tradeOpen, false);
  assert.equal(typeof parseTradeSettings({ tradeOpen: true }), "object");
  assert.equal(typeof parseTradeSettings({ paymentWaitHours: 0 }), "string");
  assert.equal(typeof parseTradeSettings({ gradeSteps: [0, 3, 3, 30, 100] }), "string");
});

test("후기 문구는 점수에 맞게(7점 이상 칭찬, 4점 이하 아쉬움), 입금자명은 닉네임 4글자 + 숫자 4자리", () => {
  assert.ok(chipsFor("B2S", 9).includes("배송이 빨라요"));
  assert.ok(!chipsFor("B2S", 9).includes("배송이 늦어요"));
  assert.ok(chipsFor("B2S", 3).includes("설명과 달라요"));
  assert.ok(!chipsFor("S2B", 2).includes("반납이 깨끗해요"));
  assert.equal(depositNameFor("한군", 42), "한군0042");
  assert.equal(depositNameFor("아주 긴 닉네임", 12345), "아주긴닉2345");
});
