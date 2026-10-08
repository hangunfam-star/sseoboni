import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, productModels, listingComponents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { eq } from "drizzle-orm";

// GET /api/listings/[id] — 상세 (P0 필수). ACTIVE가 아니면 판매자 본인에게만 보인다.
// 조회 이벤트는 상세 화면(page.tsx)에서만 기록한다(API·화면 이중 기록 방지).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  const userId = await getCurrentUserId();
  if (!listing || (listing.status !== "ACTIVE" && listing.sellerId !== userId)) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const model = await db.query.productModels.findFirst({ where: eq(productModels.id, listing.modelId) });
  const components = await db.select().from(listingComponents).where(eq(listingComponents.listingId, id));
  return NextResponse.json({ listing, model, components });
}

// PATCH /api/listings/[id] { status: ACTIVE | HIDDEN | SOLD } — 판매자 본인만 상태 변경
const ALLOWED = ["ACTIVE", "HIDDEN", "SOLD"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";
  if (!ALLOWED.includes(status)) return NextResponse.json({ error: "상태 값이 올바르지 않습니다." }, { status: 400 });

  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing || listing.sellerId !== userId || listing.status === "REMOVED") {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  const [updated] = await db.update(listings).set({ status }).where(eq(listings.id, id)).returning();
  return NextResponse.json({ listing: updated });
}
