import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { openDispute, TradeError } from "@/lib/orders";

// POST /api/orders/[id]/dispute { reason, detail } — 구매자·판매자 누구나. 열리면 자동 처리·금액 확정을 멈춘다.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    const d = await openDispute(id, userId, body?.reason, body?.detail);
    return NextResponse.json({ disputeId: d.id }, { status: 201 });
  } catch (e) {
    if (e instanceof TradeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
