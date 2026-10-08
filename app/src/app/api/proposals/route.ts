import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, marketValidationEvents, trialProposals } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { expireOldProposals } from "@/lib/trial-terms";
import { parseProposal } from "@/ui/trial-pricing";

const DAILY_MAX = 10; // 한 사람이 하루에 보낼 수 있는 제안 수

// POST /api/proposals { listingId, hours, offerFee, message? } — 구매자가 판매자에게 써보기 기간·체험비를 제안한다.
// 판매자가 "바로 판매만"을 골랐어도 제안은 받는다(사용자 결정 2026-10-08). 결제·배송은 없다.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "닉네임을 정하고 시작하면 제안할 수 있어요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  const listing = listingId ? await db.query.listings.findFirst({ where: eq(listings.id, listingId) }) : undefined;
  if (!listing || listing.status !== "ACTIVE") return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  if (listing.sellerId === userId) return NextResponse.json({ error: "내 상품에는 제안할 수 없어요." }, { status: 400 });
  const p = parseProposal(body, listing.price);
  if (typeof p === "string") return NextResponse.json({ error: p }, { status: 400 });

  expireOldProposals([listingId]);
  const result = db.transaction((tx) => {
    const pending = tx.select({ id: trialProposals.id }).from(trialProposals)
      .where(and(eq(trialProposals.listingId, listingId), eq(trialProposals.buyerId, userId), eq(trialProposals.status, "PENDING"))).get();
    if (pending) return "PENDING_EXISTS" as const;
    const today = tx.select({ n: sql<number>`count(*)` }).from(trialProposals)
      .where(and(eq(trialProposals.buyerId, userId), sql`${trialProposals.createdAt} > datetime('now','-1 day')`)).get()?.n ?? 0;
    if (today >= DAILY_MAX) return "DAILY_LIMIT" as const;
    const row = tx.insert(trialProposals).values({ listingId, buyerId: userId, hours: p.hours, offerFee: p.offerFee, message: p.message }).returning().get();
    tx.insert(marketValidationEvents).values({
      eventType: "TRIAL_PROPOSAL_SENT", listingId, modelId: listing.modelId, userId,
      metadata: JSON.stringify({ proposalId: row.id, hours: p.hours, offerFee: p.offerFee, price: listing.price }),
    }).run();
    return row;
  });
  if (result === "PENDING_EXISTS") return NextResponse.json({ error: "이 상품에 답을 기다리는 제안이 이미 있어요. MY에서 확인하거나 취소할 수 있어요." }, { status: 409 });
  if (result === "DAILY_LIMIT") return NextResponse.json({ error: "오늘은 제안을 충분히 보냈어요. 내일 다시 보내 주세요." }, { status: 429 });
  return NextResponse.json({ proposal: result }, { status: 201 });
}
