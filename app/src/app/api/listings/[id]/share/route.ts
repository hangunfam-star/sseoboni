import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";

const METHODS = ["SHARE_SHEET", "COPY_LINK"] as const;

// POST /api/listings/[id]/share { method } — 공유 시장검증 이벤트. 같은 사람·상품은 10분에 한 번만 센다.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const method = METHODS.find((m) => m === body?.method);
  if (!method) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing || listing.status !== "ACTIVE") return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  const userId = await getCurrentUserId();
  if (userId) {
    const recent = await db.query.marketValidationEvents.findFirst({
      where: and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.listingId, id), eq(marketValidationEvents.eventType, "SHARE_LISTING"),
        gt(marketValidationEvents.createdAt, sql`datetime('now', '-10 minutes')`)),
    });
    if (recent) return NextResponse.json({ ok: true, counted: false });
  }
  await db.insert(marketValidationEvents).values({ eventType: "SHARE_LISTING", listingId: id, modelId: listing.modelId, userId, metadata: JSON.stringify({ method }) });
  return NextResponse.json({ ok: true, counted: true });
}
