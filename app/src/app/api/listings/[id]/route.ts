import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, productModels, listingComponents, marketValidationEvents } from "@/db/schema";
import { parseComponents } from "@/lib/models";
import { deleteTrialTermsTx, getTrialTerms, saveTrialTermsTx } from "@/lib/trial-terms";
import { parseTrialTerms } from "@/ui/trial-pricing";
import { photosFor } from "@/lib/photos";
import { CONDITION_GRADES } from "@/ui/presentation";
import { getCurrentUserId } from "@/lib/session";
import { eq, sql } from "drizzle-orm";

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
  const photos = (await photosFor([id])).get(id) ?? [];
  const isOwner = listing.sellerId === userId;
  // 판매자 본인에게만 가장 최근 써보기 의향을 돌려준다(수정 화면 초기값)
  const latestTry = isOwner
    ? db.get<{ t: string }>(sql`select event_type as t from market_validation_events where listing_id = ${id} and event_type like 'SELLER_TRY_%' order by created_at desc, rowid desc limit 1`)?.t ?? null
    : null;
  const trialTerms = await getTrialTerms(id);
  return NextResponse.json({ listing, model, components, photos, isOwner, tryWillingness: latestTry ? latestTry.replace("SELLER_TRY_", "") : null, trialTerms });
}

// PATCH /api/listings/[id] — 판매자 본인만. 보낸 항목만 고친다.
// { status?, title?, price?, conditionGrade?, description?, components?: string[], tryWillingness?: YES|CONDITIONAL|NO }
const ALLOWED = ["ACTIVE", "HIDDEN", "SOLD"];
const TRY_EVENT: Record<string, string> = { YES: "SELLER_TRY_YES", CONDITIONAL: "SELLER_TRY_CONDITIONAL", NO: "SELLER_TRY_NO" };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing || listing.sellerId !== userId || listing.status === "REMOVED") {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const set: Partial<typeof listings.$inferInsert> = {};
  if ("status" in body) {
    if (!ALLOWED.includes(str(body.status))) return NextResponse.json({ error: "상태 값이 올바르지 않습니다." }, { status: 400 });
    set.status = str(body.status);
  }
  if ("title" in body) {
    const title = str(body.title);
    if (title.length < 2 || title.length > 60) return NextResponse.json({ error: "제목은 2~60자로 입력하세요." }, { status: 400 });
    set.title = title;
  }
  if ("price" in body) {
    const price = Number(body.price);
    if (body.price === "" || !Number.isSafeInteger(price) || price < 1000 || price > 100_000_000) {
      return NextResponse.json({ error: "가격은 1,000원 이상 1억 원 이하 정수로 입력하세요." }, { status: 400 });
    }
    set.price = price;
  }
  if ("conditionGrade" in body) {
    const g = str(body.conditionGrade);
    if (!CONDITION_GRADES.includes(g as (typeof CONDITION_GRADES)[number])) return NextResponse.json({ error: "상태 등급이 올바르지 않습니다." }, { status: 400 });
    set.conditionGrade = g;
  }
  if ("description" in body) {
    const d = str(body.description);
    if (!d || d.length > 2000) return NextResponse.json({ error: "설명은 1~2,000자로 입력하세요." }, { status: 400 });
    set.description = d;
  }
  const components = "components" in body ? parseComponents(body.components) : null;
  if (typeof components === "string") return NextResponse.json({ error: components }, { status: 400 });
  const tryWillingness = "tryWillingness" in body ? str(body.tryWillingness) : "";
  if (tryWillingness && !TRY_EVENT[tryWillingness]) return NextResponse.json({ error: "써보기 의향 값이 올바르지 않습니다." }, { status: 400 });
  // 판매자 써보기 조건: 보낸 경우 바뀐 가격 기준으로 검증. "바로 판매만"으로 바꾸면 조건을 지운다.
  const terms = "trialTerms" in body && tryWillingness !== "NO" ? parseTrialTerms(body.trialTerms, set.price ?? listing.price) : null;
  if (typeof terms === "string") return NextResponse.json({ error: terms }, { status: 400 });
  if (tryWillingness === "YES" && !terms && !(await getTrialTerms(id))) {
    return NextResponse.json({ error: "써보기 조건을 입력해 주세요." }, { status: 400 });
  }

  const updated = db.transaction((tx) => {
    const row = Object.keys(set).length > 0
      ? tx.update(listings).set(set).where(eq(listings.id, id)).returning().get()
      : listing;
    if (components) {
      tx.delete(listingComponents).where(eq(listingComponents.listingId, id)).run();
      for (const name of components) tx.insert(listingComponents).values({ listingId: id, name }).run();
    }
    if (tryWillingness === "NO") deleteTrialTermsTx(tx, id);
    else if (terms) saveTrialTermsTx(tx, id, terms);
    // 판매자 써보기 의향은 덮어쓰지 않고 새 이벤트로 남긴다(상세는 가장 최근 답을 보여 준다).
    if (tryWillingness) tx.insert(marketValidationEvents).values({ eventType: TRY_EVENT[tryWillingness], listingId: id, modelId: listing.modelId, userId }).run();
    const edited = Object.keys(set).some((k) => k !== "status") || components !== null || terms !== null;
    if (edited) tx.insert(marketValidationEvents).values({ eventType: "SELLER_LISTING_EDITED", listingId: id, modelId: listing.modelId, userId }).run();
    return row;
  });
  return NextResponse.json({ listing: updated });
}
