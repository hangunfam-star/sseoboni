import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, productModels, listingComponents, marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { eq } from "drizzle-orm";

// GET /api/listings/[id] — 상세 (P0 필수). 조회 시 시장검증 이벤트(VIEW_LISTING) 기록.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const model = await db.query.productModels.findFirst({ where: eq(productModels.id, listing.modelId) });
  const components = await db
    .select()
    .from(listingComponents)
    .where(eq(listingComponents.listingId, id));

  const userId = await getCurrentUserId();
  await db.insert(marketValidationEvents).values({
    eventType: "VIEW_LISTING",
    listingId: id,
    modelId: listing.modelId,
    userId: userId ?? null,
  });

  return NextResponse.json({ listing, model, components });
}
