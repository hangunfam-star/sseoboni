import test from "node:test";
import assert from "node:assert/strict";
import { computeTrialCost, parseProposal, parseTrialTerms, recommendDailyFee, type TrialTerms } from "./trial-pricing";

const base: TrialTerms = { hours: [24, 48, 72], dailyFee: 7400, purchaseCreditPct: 0, shippingOneWay: null, conditionNote: null };

test("추천 하루 체험비는 상품가 0.7%를 2,000~10,000원으로 자르고 100원 단위", () => {
  assert.equal(recommendDailyFee(1_050_000), 7400);
  assert.equal(recommendDailyFee(150_000), 2000);
  assert.equal(recommendDailyFee(2_000_000), 10000);
});

test("판매자 조건으로 사면·돌려보내면 금액을 계산한다", () => {
  const c = computeTrialCost(1_050_000, 72, base);
  assert.equal(c.optionFee, 22200);
  assert.equal(c.purchaseWithoutShipping, 1_072_200);
  assert.equal(c.returnWithoutShipping, 22200);
  assert.equal(c.purchaseTotal, null);
  const s = computeTrialCost(1_000_000, 48, { ...base, dailyFee: 7000, shippingOneWay: 4000, purchaseCreditPct: 50 });
  assert.equal(s.optionFee, 14000);
  assert.equal(s.purchaseCredit, 7000);
  assert.equal(s.purchaseTotal, 1_011_000);
  assert.equal(s.returnTotal, 22000);
  assert.equal(computeTrialCost(500_000, 48, { ...base, dailyFee: 3000, purchaseCreditPct: 100 }).purchaseWithoutShipping, 500_000);
});

test("판매자 조건 검증", () => {
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: 5000, purchaseCreditPct: 50, shippingOneWay: null, conditionNote: "" }, 500_000), "object");
  assert.equal(typeof parseTrialTerms({ hours: [], dailyFee: 5000, purchaseCreditPct: 0 }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [36], dailyFee: 5000, purchaseCreditPct: 0 }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: 600_000, purchaseCreditPct: 0 }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: 5000, purchaseCreditPct: 30 }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: NaN, purchaseCreditPct: 0 }, 500_000), "string");
});

test("구매자 제안 검증: 기간은 24/48/72, 금액은 0원~상품 가격", () => {
  assert.deepEqual(parseProposal({ hours: 48, offerFee: 10000, message: " 써보고 싶어요 " }, 500_000), { hours: 48, offerFee: 10000, message: "써보고 싶어요" });
  assert.equal(typeof parseProposal({ hours: 48, offerFee: 0 }, 500_000), "object");
  assert.equal(typeof parseProposal({ hours: 12, offerFee: 1000 }, 500_000), "string");
  assert.equal(typeof parseProposal({ hours: 48, offerFee: 600_000 }, 500_000), "string");
  assert.equal(typeof parseProposal({ hours: 48, offerFee: -1 }, 500_000), "string");
});
