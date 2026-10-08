// 판매자 써보기 조건 읽기·쓰기, 구매자 제안 만료 처리
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listingTrialTerms, trialProposals } from "@/db/schema";
import type { TrialTerms } from "@/ui/trial-pricing";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PROPOSAL_TTL_DAYS = 7;

// param: row DB 행. return: 화면용 조건
function toTerms(row: typeof listingTrialTerms.$inferSelect): TrialTerms {
  let hours: number[] = [];
  try { hours = JSON.parse(row.hours); } catch { hours = []; }
  return { hours, dailyFee: row.dailyFee, purchaseCreditPct: row.purchaseCreditPct, shippingOneWay: row.shippingOneWay, conditionNote: row.conditionNote };
}

// param: listingId 상품 id. return: 판매자 조건, 없으면 null
export async function getTrialTerms(listingId: string): Promise<TrialTerms | null> {
  const row = await db.query.listingTrialTerms.findFirst({ where: eq(listingTrialTerms.listingId, listingId) });
  return row ? toTerms(row) : null;
}

// param: tx 트랜잭션, listingId 상품, t 검증된 조건. 있으면 고치고 없으면 만든다.
export function saveTrialTermsTx(tx: Tx, listingId: string, t: TrialTerms): void {
  const values = { hours: JSON.stringify(t.hours), dailyFee: t.dailyFee, purchaseCreditPct: t.purchaseCreditPct, shippingOneWay: t.shippingOneWay, conditionNote: t.conditionNote };
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
