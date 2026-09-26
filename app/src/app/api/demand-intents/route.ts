import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { demandIntents, productModels, marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { eq, desc } from "drizzle-orm";

// GET /api/demand-intents?modelId=... — 찾는 상품 목록 (P0 필수: 시장검증 신호)
export async function GET(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("modelId") ?? undefined;

  const rows = await db
    .select({
      id: demandIntents.id,
      intentType: demandIntents.intentType,
      desiredPriceMin: demandIntents.desiredPriceMin,
      desiredPriceMax: demandIntents.desiredPriceMax,
      desiredTrialHours: demandIntents.desiredTrialHours,
      createdAt: demandIntents.createdAt,
      modelName: productModels.modelName,
      brand: productModels.brand,
      modelId: demandIntents.modelId,
    })
    .from(demandIntents)
    .leftJoin(productModels, eq(demandIntents.modelId, productModels.id))
    .where(modelId ? eq(demandIntents.modelId, modelId) : undefined)
    .orderBy(desc(demandIntents.createdAt));

  return NextResponse.json({ demandIntents: rows });
}

// POST /api/demand-intents — 찾는 상품/써보고 싶어요 등록 (P0 핵심 시장검증 신호)
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "먼저 닉네임으로 로그인하세요." }, { status: 401 });
  }
  const body = await req.json();
  const { modelId, intentType, desiredPriceMin, desiredPriceMax, desiredTrialHours } = body;

  if (!modelId || !intentType) {
    return NextResponse.json({ error: "modelId와 intentType은 필수입니다." }, { status: 400 });
  }
  if (!["LOOKING_TO_BUY", "WANT_TO_TRY", "PAID_TRY_INTENT"].includes(intentType)) {
    return NextResponse.json({ error: "intentType 값이 올바르지 않습니다." }, { status: 400 });
  }

  const [created] = await db
    .insert(demandIntents)
    .values({
      userId,
      modelId,
      intentType,
      desiredPriceMin: desiredPriceMin ? Number(desiredPriceMin) : null,
      desiredPriceMax: desiredPriceMax ? Number(desiredPriceMax) : null,
      desiredTrialHours: desiredTrialHours ? Number(desiredTrialHours) : null,
    })
    .returning();

  await db.insert(marketValidationEvents).values({
    eventType: `DEMAND_${intentType}`,
    modelId,
    userId,
  });

  return NextResponse.json({ demandIntent: created }, { status: 201 });
}
