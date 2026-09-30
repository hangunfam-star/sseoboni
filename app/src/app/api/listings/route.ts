import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, marketValidationEvents, productModels } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { CONDITION_GRADES } from "@/ui/presentation";
import { eq, like, and, desc } from "drizzle-orm";

const PRICE_MIN = 1000;
const PRICE_MAX = 100_000_000;
const TRY_EVENT = { YES: "SELLER_TRY_YES", CONDITIONAL: "SELLER_TRY_CONDITIONAL", NO: "SELLER_TRY_NO" } as const;

// GET /api/listings?q=검색어&modelId=... — 리스트·검색 (P0 필수)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const modelId = req.nextUrl.searchParams.get("modelId") ?? undefined;

  const conditions = [eq(listings.status, "ACTIVE")];
  if (modelId) conditions.push(eq(listings.modelId, modelId));
  if (q) conditions.push(like(listings.title, `%${q}%`));

  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      conditionGrade: listings.conditionGrade,
      status: listings.status,
      createdAt: listings.createdAt,
      modelName: productModels.modelName,
      brand: productModels.brand,
    })
    .from(listings)
    .leftJoin(productModels, eq(listings.modelId, productModels.id))
    .where(and(...conditions))
    .orderBy(desc(listings.createdAt));

  return NextResponse.json({ listings: rows });
}

// POST /api/listings — 상품 등록 (P0 필수). 판매자 로그인(초대 코드 세션) 필요.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "먼저 초대 코드로 로그인하세요." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const modelId = str(body?.modelId);
  const title = str(body?.title);
  const description = str(body?.description);
  const conditionGrade = str(body?.conditionGrade);
  const price = Number(body?.price);
  const tryWillingness = str(body?.tryWillingness);

  if (!modelId || !title || !description || !conditionGrade || body?.price === undefined || body?.price === "") {
    return NextResponse.json({ error: "필수 항목이 누락됐습니다." }, { status: 400 });
  }
  if (title.length < 2 || title.length > 60) return NextResponse.json({ error: "제목은 2~60자로 입력하세요." }, { status: 400 });
  if (description.length > 2000) return NextResponse.json({ error: "설명은 2,000자 이하로 입력하세요." }, { status: 400 });
  if (!CONDITION_GRADES.includes(conditionGrade as (typeof CONDITION_GRADES)[number])) {
    return NextResponse.json({ error: "상태 등급이 올바르지 않습니다." }, { status: 400 });
  }
  if (!Number.isSafeInteger(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return NextResponse.json({ error: "가격은 1,000원 이상 1억 원 이하 정수로 입력하세요." }, { status: 400 });
  }
  if (tryWillingness && !(tryWillingness in TRY_EVENT)) {
    return NextResponse.json({ error: "써보기 의향 값이 올바르지 않습니다." }, { status: 400 });
  }

  const model = await db.query.productModels.findFirst({ where: and(eq(productModels.id, modelId), eq(productModels.active, true)) });
  if (!model) {
    return NextResponse.json({ error: "존재하지 않는 상품 모델입니다." }, { status: 400 });
  }

  // Gate 2 승인 전까지 써보기(trial)는 항상 비활성 — §101 Validation MVP 원칙.
  // 판매자의 써보기 허용 의향은 이벤트로만 기록한다(판매자 WTA 신호).
  const created = db.transaction((tx) => {
    const row = tx
      .insert(listings)
      .values({ sellerId: userId, modelId, title, price, conditionGrade, description, directSaleEnabled: true, trialEnabled: false })
      .returning()
      .get();
    tx.insert(marketValidationEvents).values({ eventType: "SELLER_LISTING_COMPLETE", listingId: row.id, modelId, userId }).run();
    if (tryWillingness) {
      tx.insert(marketValidationEvents).values({ eventType: TRY_EVENT[tryWillingness as keyof typeof TRY_EVENT], listingId: row.id, modelId, userId }).run();
    }
    return row;
  });

  return NextResponse.json({ listing: created }, { status: 201 });
}
