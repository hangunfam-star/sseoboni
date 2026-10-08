import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, wishlists, marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { and, eq } from "drizzle-orm";

// GET /api/wishlists — 내 찜 목록
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ wishlists: [] });
  const rows = await db.select().from(wishlists).where(eq(wishlists.userId, userId));
  return NextResponse.json({ wishlists: rows });
}

// POST /api/wishlists { listingId } — 찜 토글 (P0 필수)
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  if (!listingId) {
    return NextResponse.json({ error: "listingId가 필요합니다." }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, listingId)));

  if (existing.length > 0) {
    db.transaction((tx) => {
      tx.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, listingId))).run();
      tx.insert(marketValidationEvents).values({ eventType: "WISHLIST_REMOVE", listingId, userId }).run();
    });
    return NextResponse.json({ wished: false });
  }

  const listing = await db.query.listings.findFirst({ where: and(eq(listings.id, listingId), eq(listings.status, "ACTIVE")) });
  if (!listing) {
    return NextResponse.json({ error: "판매 중인 상품이 아닙니다." }, { status: 404 });
  }

  db.transaction((tx) => {
    tx.insert(wishlists).values({ userId, listingId }).run();
    tx.insert(marketValidationEvents).values({ eventType: "WISHLIST_ADD", listingId, modelId: listing.modelId, userId }).run();
  });
  return NextResponse.json({ wished: true });
}
