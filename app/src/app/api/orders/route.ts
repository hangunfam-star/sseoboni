import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { createOrder, listOrders, TradeError } from "@/lib/orders";

// GET /api/orders?side=buyer|seller — 내 거래 목록
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ orders: [] });
  const side = req.nextUrl.searchParams.get("side");
  return NextResponse.json({ orders: await listOrders(userId, side === "buyer" || side === "seller" ? side : "all") });
}

// POST /api/orders { listingId, kind: BUY|TRIAL, hours?, proposalId?, questions?, shipTo } — 구매·써보기 신청
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.listingId !== "string") return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  try {
    const order = await createOrder(userId, {
      listingId: body.listingId, kind: body.kind, hours: typeof body.hours === "number" ? body.hours : undefined,
      proposalId: typeof body.proposalId === "string" ? body.proposalId : undefined, questions: body.questions, shipTo: body.shipTo,
    });
    return NextResponse.json({ orderId: order.id }, { status: 201 });
  } catch (e) {
    if (e instanceof TradeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
