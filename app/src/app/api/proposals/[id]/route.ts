import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, marketValidationEvents, trialProposals } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { expireOldProposals } from "@/lib/trial-terms";

// PATCH /api/proposals/[id] { action: ACCEPT | DECLINE | CANCEL, reply? }
// 판매자는 승인·거절, 구매자는 취소만 할 수 있다. 답을 기다리는 제안(PENDING)만 바꿀 수 있다.
const EVENT = { ACCEPT: "TRIAL_PROPOSAL_ACCEPTED", DECLINE: "TRIAL_PROPOSAL_DECLINED", CANCEL: "TRIAL_PROPOSAL_CANCELLED" } as const;
const STATUS = { ACCEPT: "ACCEPTED", DECLINE: "DECLINED", CANCEL: "CANCELLED" } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  if (!(action in EVENT)) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const reply = typeof body?.reply === "string" ? body.reply.trim() : "";
  if (reply.length > 200) return NextResponse.json({ error: "답장은 200자 이하로 적어 주세요." }, { status: 400 });

  const proposal = await db.query.trialProposals.findFirst({ where: eq(trialProposals.id, id) });
  if (!proposal) return NextResponse.json({ error: "제안을 찾을 수 없습니다." }, { status: 404 });
  expireOldProposals([proposal.listingId]);
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, proposal.listingId) });
  if (!listing) return NextResponse.json({ error: "제안을 찾을 수 없습니다." }, { status: 404 });
  const isSeller = listing.sellerId === userId;
  const isBuyer = proposal.buyerId === userId;
  if ((action === "CANCEL" && !isBuyer) || (action !== "CANCEL" && !isSeller)) {
    return NextResponse.json({ error: "제안을 찾을 수 없습니다." }, { status: 404 });
  }

  const key = action as keyof typeof EVENT;
  const updated = db.transaction((tx) => {
    // 상태가 PENDING일 때만 바꾼다(동시에 두 번 눌러도 한 번만 반영).
    const row = tx.update(trialProposals)
      .set({ status: STATUS[key], sellerReply: action === "CANCEL" ? proposal.sellerReply : reply || null, decidedAt: sql`(current_timestamp)` })
      .where(sql`${trialProposals.id} = ${id} and ${trialProposals.status} = 'PENDING'`)
      .returning().get();
    if (!row) return null;
    tx.insert(marketValidationEvents).values({
      eventType: EVENT[key], listingId: listing.id, modelId: listing.modelId, userId,
      metadata: JSON.stringify({ proposalId: id, hours: proposal.hours, offerFee: proposal.offerFee, price: listing.price }),
    }).run();
    return row;
  });
  if (!updated) return NextResponse.json({ error: "이미 답했거나 만료된 제안이에요." }, { status: 409 });
  return NextResponse.json({ proposal: updated });
}
