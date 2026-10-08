import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { categories, listings, marketValidationEvents, productModels } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { CONDITION_GRADES } from "@/ui/presentation";
import { isSellCategory } from "@/ui/categories";
import { eq, like, and, desc, sql } from "drizzle-orm";

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

// POST /api/listings — 상품 등록 (P0 필수). 판매자 세션(닉네임으로 시작) 필요.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  let modelId = str(body?.modelId);
  // 직접 입력: 목록에 없는 상품을 판매자가 브랜드·모델명·종류로 적어 올린다.
  const custom = body?.customModel && typeof body.customModel === "object"
    ? { brand: str(body.customModel.brand), modelName: str(body.customModel.modelName), category: str(body.customModel.category) }
    : null;
  const title = str(body?.title);
  const description = str(body?.description);
  const conditionGrade = str(body?.conditionGrade);
  const price = Number(body?.price);
  const tryWillingness = str(body?.tryWillingness);

  if ((!modelId && !custom) || !title || !description || !conditionGrade || body?.price === undefined || body?.price === "") {
    return NextResponse.json({ error: "필수 항목이 누락됐습니다." }, { status: 400 });
  }
  if (!modelId && custom) {
    if (custom.brand.length < 1 || custom.brand.length > 30) return NextResponse.json({ error: "브랜드는 1~30자로 입력하세요." }, { status: 400 });
    if (custom.modelName.length < 2 || custom.modelName.length > 60) return NextResponse.json({ error: "모델명은 2~60자로 입력하세요." }, { status: 400 });
    if (!isSellCategory(custom.category)) return NextResponse.json({ error: "상품 종류를 골라 주세요." }, { status: 400 });
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

  if (modelId) {
    const model = await db.query.productModels.findFirst({ where: and(eq(productModels.id, modelId), eq(productModels.active, true)) });
    if (!model) {
      return NextResponse.json({ error: "존재하지 않는 상품 모델입니다." }, { status: 400 });
    }
  }

  // Gate 2 승인 전까지 써보기(trial)는 항상 비활성 — §101 Validation MVP 원칙.
  // 판매자의 써보기 허용 의향은 이벤트로만 기록한다(판매자 WTA 신호).
  const created = db.transaction((tx) => {
    let createdModel = false;
    if (!modelId && custom) {
      // 같은 브랜드·모델명(대소문자·앞뒤 공백 무시)이 이미 있으면 그 모델을 쓴다 → 수요 집계가 한 모델로 모인다.
      const existing = tx.select({ id: productModels.id }).from(productModels)
        .where(and(eq(productModels.active, true),
          sql`lower(trim(${productModels.brand})) = lower(${custom.brand})`,
          sql`lower(trim(${productModels.modelName})) = lower(${custom.modelName})`))
        .get();
      if (existing) {
        modelId = existing.id;
      } else {
        const category = tx.select({ id: categories.id }).from(categories).where(eq(categories.name, custom.category)).get()
          ?? tx.insert(categories).values({ name: custom.category, trialEnabled: false }).returning({ id: categories.id }).get();
        modelId = tx.insert(productModels).values({
          brand: custom.brand,
          modelName: custom.modelName,
          categoryId: category.id,
          canonicalSpec: JSON.stringify({ source: "SELLER_INPUT", createdBy: userId }),
        }).returning({ id: productModels.id }).get().id;
        createdModel = true;
      }
    }
    const row = tx
      .insert(listings)
      .values({ sellerId: userId, modelId, title, price, conditionGrade, description, directSaleEnabled: true, trialEnabled: false })
      .returning()
      .get();
    tx.insert(marketValidationEvents).values({ eventType: "SELLER_LISTING_COMPLETE", listingId: row.id, modelId, userId }).run();
    if (createdModel) {
      tx.insert(marketValidationEvents).values({ eventType: "SELLER_MODEL_CREATED", listingId: row.id, modelId, userId }).run();
    }
    if (tryWillingness) {
      tx.insert(marketValidationEvents).values({ eventType: TRY_EVENT[tryWillingness as keyof typeof TRY_EVENT], listingId: row.id, modelId, userId }).run();
    }
    return row;
  });

  return NextResponse.json({ listing: created }, { status: 201 });
}
