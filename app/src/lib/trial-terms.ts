// 판매자 써보기 조건 읽기·쓰기, 구매자 제안 만료 처리
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listingTrialTerms, trialProposals } from "@/db/schema";
import type { TrialTerms, TrialTier } from "@/ui/trial-pricing";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PROPOSAL_TTL_DAYS = 7;

// param: row DB 행. return: 구간별 체험비(tier_fees가 없으면 예전 하루 체험비 × 일수로 만든다)
export function tiersOf(row: { hours: string; dailyFee: number; tierFees: string | null }): TrialTier[] {
  try {
    if (row.tierFees) return (JSON.parse(row.tierFees) as TrialTier[]).sort((a, b) => a.hours - b.hours);
  } catch { /* 깨진 값은 아래 호환 계산으로 */ }
  let hours: number[] = [];
  try { hours = JSON.parse(row.hours); } catch { hours = []; }
  return hours.sort((a, b) => a - b).map((h) => ({ hours: h, fee: row.dailyFee * Math.max(1, Math.ceil(h / 24)) }));
}

// param: row DB 행. return: 화면용 조건
function toTerms(row: typeof listingTrialTerms.$inferSelect): TrialTerms {
  return { tiers: tiersOf(row), shippingOneWay: row.shippingOneWay, conditionNote: row.conditionNote };
}

// param: listingId 상품 id. return: 판매자 조건, 없으면 null
export async function getTrialTerms(listingId: string): Promise<TrialTerms | null> {
  const row = await db.query.listingTrialTerms.findFirst({ where: eq(listingTrialTerms.listingId, listingId) });
  return row ? toTerms(row) : null;
}

// param: tx 트랜잭션, listingId 상품. return: 가장 비싼 구간 체험비(없으면 null) — 가격 인하 검증용
export function maxTierFeeTx(tx: Tx, listingId: string): number | null {
  const row = tx.select().from(listingTrialTerms).where(eq(listingTrialTerms.listingId, listingId)).get();
  return row ? Math.max(...tiersOf(row).map((t) => t.fee)) : null;
}

// param: tx 트랜잭션, listingId 상품, t 검증된 조건. 있으면 고치고 없으면 만든다.
export function saveTrialTermsTx(tx: Tx, listingId: string, t: TrialTerms): void {
  // purchase_credit_pct: 사면 체험비 0원 정책이라 항상 100(과거 호환 열). daily_fee: 가장 짧은 구간 체험비(정렬·호환용)
  const values = {
    hours: JSON.stringify(t.tiers.map((x) => x.hours)),
    tierFees: JSON.stringify(t.tiers),
    dailyFee: t.tiers[0].fee,
    purchaseCreditPct: 100,
    shippingOneWay: t.shippingOneWay,
    conditionNote: t.conditionNote,
  };
  const exists = tx.select({ id: listingTrialTerms.listingId }).from(listingTrialTerms).where(eq(listingTrialTerms.listingId, listingId)).get();
  if (exists) tx.update(listingTrialTerms).set({ ...values, updatedAt: sql`(current_timestamp)` }).where(eq(listingTrialTerms.listingId, listingId)).run();
  else tx.insert(listingTrialTerms).values({ listingId, ...values }).run();
}

// param: tx 트랜잭션, listingId 상품. 판매자가 "바로 판매만"으로 바꾸면 조건을 지운다.
export function deleteTrialTermsTx(tx: Tx, listingId: string): void {
  tx.delete(listingTrialTerms).where(eq(listingTrialTerms.listingId, listingId)).run();
}

// 답이 없는 지 7일이 지난 제안을 만료로 바꾼다(읽을 때마다 정리).
// param: listingIds 대상 상품(없으면 전체)
export function expireOldProposals(listingIds?: string[]): void {
  const old = sql`${trialProposals.createdAt} < datetime('now', ${`-${PROPOSAL_TTL_DAYS} days`})`;
  db.update(trialProposals)
    .set({ status: "EXPIRED", decidedAt: sql`(current_timestamp)` })
    .where(and(eq(trialProposals.status, "PENDING"), old, listingIds ? inArray(trialProposals.listingId, listingIds) : undefined))
    .run();
}
