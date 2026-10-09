import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { TradeError } from "@/lib/orders";
import { writeReview, writeTrialReview } from "@/lib/reviews";

// POST /api/orders/[id]/review { type: TRADE|TRIAL, ... } — 거래 평가(교차) 또는 써보니 후기(체험 구매자)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || (body.type !== "TRADE" && body.type !== "TRIAL")) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  try {
    if (body.type === "TRADE") await writeReview(id, userId, body);
    else await writeTrialReview(id, userId, body);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof TradeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
