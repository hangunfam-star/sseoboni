import { NextResponse } from "next/server";
import { db } from "@/db/client";

// GET /api/models — 상품 등록 폼의 모델 드롭다운용 (1차 출시: 노트북 3종)
export async function GET() {
  const models = await db.query.productModels.findMany({
    where: (m, { eq }) => eq(m.active, true),
  });
  return NextResponse.json({ models });
}
