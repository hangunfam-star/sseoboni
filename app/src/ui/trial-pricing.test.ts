import test from "node:test";
import assert from "node:assert/strict";
import { computeTrialCost, findContactInfo, parseProposal, parseTrialTerms, recommendDailyFee, type TrialTerms } from "./trial-pricing";

const base: TrialTerms = { hours: [24, 48, 72], dailyFee: 7400, shippingOneWay: null, conditionNote: null };

test("추천 하루 체험비는 상품가 0.7%를 2,000~10,000원으로 자르고 100원 단위", () => {
  assert.equal(recommendDailyFee(1_050_000), 7400);
  assert.equal(recommendDailyFee(150_000), 2000);
  assert.equal(recommendDailyFee(2_000_000), 10000);
});

test("써보고 사면 체험비 0원, 돌려보내면 체험비(+왕복 배송)", () => {
  const c = computeTrialCost(1_050_000, 72, base);
  assert.equal(c.optionFee, 22200);
  assert.equal(c.purchaseWithoutShipping, 1_050_000);
  assert.equal(c.returnWithoutShipping, 22200);
  assert.equal(c.purchaseTotal, null);
  const s = computeTrialCost(1_000_000, 48, { ...base, dailyFee: 7000, shippingOneWay: 4000 });
  assert.equal(s.purchaseTotal, 1_004_000);
  assert.equal(s.returnTotal, 22000);
});

test("판매자 조건 검증", () => {
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: 5000, shippingOneWay: null, conditionNote: "" }, 500_000), "object");
  assert.equal(typeof parseTrialTerms({ hours: [], dailyFee: 5000 }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [36], dailyFee: 5000 }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: 600_000 }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: NaN }, 500_000), "string");
  assert.equal(typeof parseTrialTerms({ hours: [48], dailyFee: 5000, conditionNote: "카톡 abc123으로 연락" }, 500_000), "string");
});

test("구매자 제안 검증: 기간은 24/48/72, 금액은 0원~상품 가격, 연락처 금지", () => {
  assert.deepEqual(parseProposal({ hours: 48, offerFee: 10000, message: " 써보고 싶어요 " }, 500_000), { hours: 48, offerFee: 10000, message: "써보고 싶어요" });
  assert.equal(typeof parseProposal({ hours: 48, offerFee: 0 }, 500_000), "object");
  assert.equal(typeof parseProposal({ hours: 12, offerFee: 1000 }, 500_000), "string");
  assert.equal(typeof parseProposal({ hours: 48, offerFee: 600_000 }, 500_000), "string");
  assert.equal(typeof parseProposal({ hours: 48, offerFee: 1000, message: "010-1234-5678로 문자 주세요" }, 500_000), "string");
});

test("연락처·계좌 찾기", () => {
  assert.equal(findContactInfo("010-1234-5678"), "전화번호");
  assert.equal(findContactInfo("01012345678 문자"), "전화번호");
  assert.equal(findContactInfo("me@example.com"), "이메일");
  assert.equal(findContactInfo("오픈채팅 주세요"), "메신저 아이디");
  assert.equal(findContactInfo("국민 123456-78-901234 입금"), "계좌번호");
  assert.equal(findContactInfo("48시간 14,800원이면 좋겠어요"), null);
  assert.equal(findContactInfo("주말에 영상 편집용으로 써보고 싶어요"), null);
});
