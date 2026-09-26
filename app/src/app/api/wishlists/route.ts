import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { wishlists, marketValidationEvents } from "@/db/schema";
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
    return NextResponse.json({ error: "먼저 닉네임으로 로그인하세요." }, { status: 401 });
  }
  const { listingId } = await req.json();
  if (!listingId) {
    return NextResponse.json({ error: "listingId가 필요합니다." }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, listingId)));

  if (existing.length > 0) {
    await db.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, listingId)));
    return NextResponse.json({ wished: false });
  }

  await db.insert(wishlists).values({ userId, listingId });
  await db.insert(marketValidationEvents).values({
    eventType: "WISHLIST_ADD",
    listingId,
    userId,
  });
  return NextResponse.json({ wished: true });
}
