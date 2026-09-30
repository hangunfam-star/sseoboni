import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";

// POST /api/intents { listingId, kind: "TRY" | "BUY" }
// Gate 0: 거래·결제·신청이 아니라 의향 이벤트만 기록한다. 같은 사람·상품·종류는 1회만 기록.
const EVENT = { TRY: "CLICK_TRY_WANT", BUY: "CLICK_BUY_WANT" } as const;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 초대 코드로 로그인하세요." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  const kind = body?.kind === "TRY" || body?.kind === "BUY" ? (body.kind as keyof typeof EVENT) : null;
  if (!listingId || !kind) return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });

  const listing = await db.query.listings.findFirst({ where: and(eq(listings.id, listingId), eq(listings.status, "ACTIVE")) });
  if (!listing) return NextResponse.json({ error: "판매 중인 상품이 아닙니다." }, { status: 404 });

  const eventType = EVENT[kind];
  const exists = await db.query.marketValidationEvents.findFirst({
    where: and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.listingId, listingId), eq(marketValidationEvents.eventType, eventType)),
  });
  if (!exists) {
    await db.insert(marketValidationEvents).values({ eventType, listingId, modelId: listing.modelId, userId });
  }
  return NextResponse.json({ recorded: true, already: Boolean(exists) }, { status: exists ? 200 : 201 });
}
