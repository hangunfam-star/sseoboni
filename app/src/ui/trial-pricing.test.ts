import test from "node:test";
import assert from "node:assert/strict";
import { computeTrialCost, DEFAULT_TRIAL_PRICING, parseTrialPricing } from "./trial-pricing";

test("기본 가격안: 하루 체험비는 상품가 0.7%를 2,000~10,000원으로 자르고 100원 단위", () => {
  const laptop = computeTrialCost(1_050_000, 72, DEFAULT_TRIAL_PRICING);
  assert.equal(laptop.dailyFee, 7400);
  assert.equal(laptop.optionFee, 22200);
  assert.equal(laptop.purchaseWithoutShipping, 1_072_200);
  assert.equal(laptop.returnWithoutShipping, 22200);
  assert.equal(laptop.purchaseTotal, null);
  assert.equal(laptop.returnTotal, null);
  assert.equal(computeTrialCost(150_000, 48, DEFAULT_TRIAL_PRICING).optionFee, 4000);
  assert.equal(computeTrialCost(2_000_000, 24, DEFAULT_TRIAL_PRICING).optionFee, 10000);
});

test("배송비·구매 시 상계가 정해지면 구매/반환 최종 금액을 계산한다", () => {
  const p = { ...DEFAULT_TRIAL_PRICING, shippingOneWay: 4000, purchaseCreditPct: 50 };
  const c = computeTrialCost(1_000_000, 48, p);
  assert.equal(c.optionFee, 14000);
  assert.equal(c.purchaseCredit, 7000);
  assert.equal(c.purchaseTotal, 1_011_000);
  assert.equal(c.returnTotal, 22000);
});

test("가격안 검증: 잘못된 값은 거부한다", () => {
  const ok = { ...DEFAULT_TRIAL_PRICING };
  assert.equal(typeof parseTrialPricing(ok), "object");
  assert.equal(typeof parseTrialPricing({ ...ok, dailyMin: 5000, dailyMax: 1000 }), "string");
  assert.equal(typeof parseTrialPricing({ ...ok, hours: [] }), "string");
  assert.equal(typeof parseTrialPricing({ ...ok, purchaseCreditPct: 150 }), "string");
  assert.equal(typeof parseTrialPricing({ ...ok, dailyRatePct: -1 }), "string");
});
