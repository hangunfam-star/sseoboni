import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { loadTrialPricing } from "@/lib/trial-pricing-store";
import { computeTrialCost } from "@/ui/trial-pricing";

// POST /api/trial-cost { listingId, action: VIEW | STILL_TRY | DECLINE, hours }
// 써보기 예상 비용을 본 것·"그래도 써볼래요"·"안 할래요"를 기록한다(§59 trial_cost_view, still_try_click). 결제·신청은 없다.
// 금액은 화면 값을 믿지 않고 서버가 DB 가격과 지금 가격안으로 다시 계산해 함께 남긴다.
const EVENT = { VIEW: "TRIAL_COST_VIEW", STILL_TRY: "STILL_TRY_CLICK", DECLINE: "TRIAL_COST_DECLINE" } as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const hours = Number(body?.hours);
  if (!listingId || !(action in EVENT)) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });

  const userId = await getCurrentUserId();
  if (action !== "VIEW" && !userId) return NextResponse.json({ error: "닉네임을 정하고 시작하면 의견을 남길 수 있어요." }, { status: 401 });

  const listing = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
  if (!listing || listing.status !== "ACTIVE") return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  if (listing.sellerId === userId) return NextResponse.json({ ok: true, skipped: "owner" });

  const pricing = await loadTrialPricing();
  if (!pricing.hours.includes(hours)) return NextResponse.json({ error: "써보기 기간이 올바르지 않습니다." }, { status: 400 });
  const latest = await db.select({ t: marketValidationEvents.eventType }).from(marketValidationEvents)
    .where(and(eq(marketValidationEvents.listingId, listingId), sql`${marketValidationEvents.eventType} like 'SELLER_TRY_%'`))
    .orderBy(desc(marketValidationEvents.createdAt), sql`rowid desc`).limit(1);
  if (latest[0]?.t === "SELLER_TRY_NO") return NextResponse.json({ error: "이 판매자는 바로 판매만 원해요." }, { status: 409 });

  const cost = computeTrialCost(listing.price, hours, pricing);
  const eventType = EVENT[action as keyof typeof EVENT];
  // 같은 사람이 같은 상품의 비용을 30분 안에 다시 보면 한 번으로 센다.
  if (action === "VIEW" && userId) {
    const recent = await db.select({ id: marketValidationEvents.id }).from(marketValidationEvents)
      .where(and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.listingId, listingId), eq(marketValidationEvents.eventType, eventType),
        sql`${marketValidationEvents.createdAt} > datetime('now','-30 minutes')`)).limit(1);
    if (recent.length > 0) return NextResponse.json({ ok: true, deduped: true });
  }
  await db.insert(marketValidationEvents).values({
    eventType, listingId, modelId: listing.modelId, userId,
    metadata: JSON.stringify({
      hours, price: listing.price, optionFee: cost.optionFee, purchaseCredit: cost.purchaseCredit,
      shippingOneWay: cost.shippingOneWay, purchaseTotal: cost.purchaseTotal, returnTotal: cost.returnTotal, pricingVersion: pricing.version,
    }),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
