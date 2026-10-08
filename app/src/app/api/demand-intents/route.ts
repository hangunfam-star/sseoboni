import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { demandIntents, productModels, marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { and, eq, desc } from "drizzle-orm";

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
    return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const modelId = typeof body?.modelId === "string" ? body.modelId : "";
  const intentType = typeof body?.intentType === "string" ? body.intentType : "";

  if (!modelId || !intentType) {
    return NextResponse.json({ error: "모델과 목적을 선택하세요." }, { status: 400 });
  }
  if (!["LOOKING_TO_BUY", "WANT_TO_TRY", "PAID_TRY_INTENT"].includes(intentType)) {
    return NextResponse.json({ error: "intentType 값이 올바르지 않습니다." }, { status: 400 });
  }
  // 빈 값은 미입력(null). 숫자는 0 이상 1억 이하 정수만 허용한다.
  const num = (v: unknown, max: number): number | null | "bad" => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : "bad";
  };
  const min = num(body?.desiredPriceMin, 100_000_000);
  const max = num(body?.desiredPriceMax, 100_000_000);
  const hours = num(body?.desiredTrialHours, 24 * 30);
  if (min === "bad" || max === "bad" || hours === "bad") {
    return NextResponse.json({ error: "가격·기간은 0 이상의 정수로 입력하세요." }, { status: 400 });
  }
  if (min !== null && max !== null && min > max) {
    return NextResponse.json({ error: "최소 가격이 최대 가격보다 클 수 없어요." }, { status: 400 });
  }
  const model = await db.query.productModels.findFirst({ where: and(eq(productModels.id, modelId), eq(productModels.active, true)) });
  if (!model) {
    return NextResponse.json({ error: "존재하지 않는 상품 모델입니다." }, { status: 400 });
  }

  // 같은 사람·모델·목적의 요청은 새로 만들지 않고 조건만 고친다(수요 부풀림 방지).
  const values = { desiredPriceMin: min, desiredPriceMax: max, desiredTrialHours: hours, active: true };
  const existing = await db.query.demandIntents.findFirst({
    where: and(eq(demandIntents.userId, userId), eq(demandIntents.modelId, modelId), eq(demandIntents.intentType, intentType)),
  });
  const saved = db.transaction((tx) => {
    const row = existing
      ? tx.update(demandIntents).set(values).where(eq(demandIntents.id, existing.id)).returning().get()
      : tx.insert(demandIntents).values({ userId, modelId, intentType, ...values }).returning().get();
    if (!existing) tx.insert(marketValidationEvents).values({ eventType: `DEMAND_${intentType}`, modelId, userId }).run();
    return row;
  });

  return NextResponse.json({ demandIntent: saved, updated: Boolean(existing) }, { status: existing ? 200 : 201 });
}
