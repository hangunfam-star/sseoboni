import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { modelDemand } from "@/lib/queries";

// GET /api/models — 등록·찾는 상품 폼의 모델 목록. seekers는 중복 제거한 찾는 사람 수(표시 기준은 화면에서 적용).
export async function GET() {
  const models = await db.query.productModels.findMany({
    where: (m, { eq }) => eq(m.active, true),
  });
  const demand = new Map((await modelDemand()).map((d) => [d.modelId, d]));
  return NextResponse.json({
    models: models.map((m) => ({ ...m, seekers: demand.get(m.id)?.seekers ?? 0, onSale: demand.get(m.id)?.onSale ?? 0 })),
  });
}
