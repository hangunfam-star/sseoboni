import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, productModels } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { eq, like, and, desc } from "drizzle-orm";

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

// POST /api/listings — 상품 등록 (P0 필수). 판매자 로그인(닉네임 세션) 필요.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "먼저 닉네임으로 로그인하세요." }, { status: 401 });
  }

  const body = await req.json();
  const { modelId, title, price, conditionGrade, description } = body;

  if (!modelId || !title || !price || !conditionGrade || !description) {
    return NextResponse.json({ error: "필수 항목이 누락됐습니다." }, { status: 400 });
  }

  const model = await db.query.productModels.findFirst({ where: eq(productModels.id, modelId) });
  if (!model) {
    return NextResponse.json({ error: "존재하지 않는 상품 모델입니다." }, { status: 400 });
  }

  // Gate 2 승인 전까지 써보기(trial)는 항상 비활성 — §101 Validation MVP 원칙
  const [created] = await db
    .insert(listings)
    .values({
      sellerId: userId,
      modelId,
      title,
      price: Number(price),
      conditionGrade,
      description,
      directSaleEnabled: true,
      trialEnabled: false,
    })
    .returning();

  return NextResponse.json({ listing: created }, { status: 201 });
}
