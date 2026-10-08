import test from "node:test";
import assert from "node:assert/strict";
import { computeTrialCost, findContactInfo, parseProposal, parseTrialTerms, platformFee, recommendDailyFee, recommendTierFee, tierForHours, type TrialTerms } from "./trial-pricing";
import { currentFeePct, kstDate, parsePlatformFee } from "./platform-fee";

// 사용자 예시: 24시간 1,000원 · 48시간 2,000원 · 72시간 3,000원, 미리 결제 10만원, 수수료 3%
const terms: TrialTerms = { tiers: [{ hours: 24, fee: 1000 }, { hours: 48, fee: 2000 }, { hours: 72, fee: 3000 }], shippingOneWay: null, conditionNote: null };

test("추천 체험비: 하루 상품가 0.7%(2,000~10,000원) × 일수", () => {
  assert.equal(recommendDailyFee(1_050_000), 7400);
  assert.equal(recommendTierFee(1_050_000, 72), 22200);
  assert.equal(recommendTierFee(150_000, 48), 4000);
});

test("정한 구간을 넘기면 다음 구간 요금, 가장 긴 구간을 넘기면 구매 처리(null)", () => {
  assert.equal(tierForHours(24, terms.tiers)?.fee, 1000);
  assert.equal(tierForHours(25, terms.tiers)?.fee, 2000);
  assert.equal(tierForHours(48, terms.tiers)?.fee, 2000);
  assert.equal(tierForHours(49, terms.tiers)?.fee, 3000);
  assert.equal(tierForHours(73, terms.tiers), null);
  assert.equal(tierForHours(30, [{ hours: 24, fee: 1000 }, { hours: 72, fee: 3000 }])?.hours, 72);
});

test("미리 결제 10만원: 돌려보내면 체험비 + 수수료 3%를 빼고 환불, 사면 구매자 10만원·판매자 97,000원 입금", () => {
  assert.equal(platformFee(100_000, 3), 3000);
  const c = computeTrialCost(100_000, 24, terms, 3);
  assert.equal(c.tierFee, 1000);
  assert.equal(c.fee, 3000);
  assert.equal(c.returnCharge, 4000);
  assert.equal(c.refund, 96_000);
  assert.equal(c.purchaseTotal, 100_000);
  assert.equal(c.sellerPayoutOnPurchase, 97_000);
  assert.equal(c.sellerPayoutOnReturn, 1000);
  const promo = computeTrialCost(100_000, 72, terms, 0);
  assert.equal(promo.refund, 97_000);
  assert.equal(promo.purchaseTotal, 100_000);
  assert.equal(promo.sellerPayoutOnPurchase, 100_000);
});

test("판매자 조건 검증: 긴 구간이 더 싸면 거부", () => {
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 24, fee: 1000 }, { hours: 48, fee: 2000 }] }, 100_000), "object");
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 24, fee: 3000 }, { hours: 48, fee: 2000 }] }, 100_000), "string");
  assert.equal(typeof parseTrialTerms({ tiers: [] }, 100_000), "string");
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 36, fee: 1000 }] }, 100_000), "string");
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 24, fee: 200_000 }] }, 100_000), "string");
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 24, fee: NaN }] }, 100_000), "string");
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 24, fee: 1000 }], conditionNote: "카톡 abc123" }, 100_000), "string");
});

test("구매자 제안 검증·연락처 차단", () => {
  assert.deepEqual(parseProposal({ hours: 48, offerFee: 10000, message: " 써보고 싶어요 " }, 500_000), { hours: 48, offerFee: 10000, message: "써보고 싶어요" });
  assert.equal(typeof parseProposal({ hours: 12, offerFee: 1000 }, 500_000), "string");
  assert.equal(typeof parseProposal({ hours: 48, offerFee: 600_000 }, 500_000), "string");
  assert.equal(typeof parseProposal({ hours: 48, offerFee: 1000, message: "010-1234-5678로 문자 주세요" }, 500_000), "string");
  assert.equal(findContactInfo("me@example.com"), "이메일");
  assert.equal(findContactInfo("오픈채팅 주세요"), "메신저 아이디");
  assert.equal(findContactInfo("국민 123456-78-901234 입금"), "계좌번호");
  assert.equal(findContactInfo("48시간 14,800원이면 좋겠어요"), null);
});

test("수수료 설정: 기본 3%, 특정 기간(한국 날짜, 끝 포함)에는 그 비율", () => {
  const c = { defaultPct: 3, promos: [{ start: "2026-10-10", end: "2026-10-12", pct: 0, label: "오픈 기념" }] };
  assert.equal(kstDate(new Date("2026-10-09T15:30:00Z")), "2026-10-10");
  assert.equal(currentFeePct(c, new Date("2026-10-09T14:00:00Z")).pct, 3);
  assert.equal(currentFeePct(c, new Date("2026-10-10T01:00:00Z")).pct, 0);
  assert.equal(currentFeePct(c, new Date("2026-10-12T14:59:00Z")).pct, 0);
  assert.equal(currentFeePct(c, new Date("2026-10-12T15:00:00Z")).pct, 3);
  assert.equal(typeof parsePlatformFee({ defaultPct: 3, promos: [{ start: "2026-10-12", end: "2026-10-10", pct: 0 }] }), "string");
  assert.equal(typeof parsePlatformFee({ defaultPct: 3, promos: [{ start: "2026-10-10", end: "2026-10-12", pct: 0 }, { start: "2026-10-12", end: "2026-10-13", pct: 1 }] }), "string");
  assert.equal(typeof parsePlatformFee({ defaultPct: 50, promos: [] }), "string");
});

test("연락처 필터: 구분자·보이지 않는 문자·우회 표기도 막고, 가격·날짜는 통과", () => {
  assert.equal(findContactInfo("01 0-12 34. 5678"), "전화번호");
  assert.equal(findContactInfo("010​1234​5678"), "전화번호");
  assert.equal(findContactInfo("０１０－１２３４－５６７８"), "전화번호");
  assert.equal(findContactInfo("공일공 일이삼사"), "전화번호");
  assert.equal(findContactInfo("abc123 골뱅이 naver"), "이메일");
  assert.equal(findContactInfo("지메일로 주세요"), "이메일");
  assert.notEqual(findContactInfo("110-123-456789"), null);
  assert.equal(findContactInfo("1,050,000원에 48시간 써볼게요"), null);
  assert.equal(findContactInfo("2026-10-08 토요일 가능해요"), null);
});

test("검수 반영: 정한 구간만 계산, 체험비+수수료 ≤ 가격, 수수료 정수 계산, 실제 날짜만", () => {
  assert.throws(() => computeTrialCost(100_000, 73, terms, 3));
  assert.equal(platformFee(50, 3), 2);
  assert.equal(platformFee(100_000, 2.5), 2500);
  assert.equal(platformFee(1_000, 0.1), 1);
  const tight = computeTrialCost(1_000, 24, { ...terms, tiers: [{ hours: 24, fee: 1_000 }] }, 3);
  assert.equal(tight.valid, false);
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 24, fee: 1_000 }] }, 1_000, 3), "string");
  assert.equal(typeof parseTrialTerms({ tiers: [{ hours: 24, fee: 970 }] }, 1_000, 3), "object");
  assert.equal(typeof parsePlatformFee({ defaultPct: 3, promos: [{ start: "2026-02-28", end: "2026-02-31", pct: 0 }] }), "string");
  assert.equal(typeof parsePlatformFee({ defaultPct: 3, promos: [{ start: "2028-02-28", end: "2028-02-29", pct: 0 }] }), "object");
});

test("재검수 반영: 없는 달 날짜 예외 없이 거부, 한글 채움 문자·닷컴 우회 차단", () => {
  assert.equal(typeof parsePlatformFee({ defaultPct: 3, promos: [{ start: "2026-13-01", end: "2026-13-02", pct: 0 }] }), "string");
  assert.equal(findContactInfo("010\u3164-1234-5678"), "전화번호");
  assert.equal(findContactInfo("abc 닷컴으로"), "이메일");
});
