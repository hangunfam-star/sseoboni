import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { act, orderView, TradeError } from "@/lib/orders";

const ACTIONS = ["CONFIRM_PAYMENT", "SHIP", "RECEIVED", "EXTEND", "PURCHASE", "RETURN", "RETURN_SHIPPED", "INSPECT", "REFUND_SENT", "REFUND_RECEIVED", "CANCEL", "SET_REFUND_ACCOUNT"] as const;

// GET /api/orders/[id] — 참여자만
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const view = await orderView(id, userId);
  if (!view) return NextResponse.json({ error: "거래를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ order: view });
}

// PATCH /api/orders/[id] { action, ...입력 } — 역할·상태에 맞는 행동만 반영한다
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const action = ACTIONS.find((a) => a === body?.action);
  if (!action) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  try {
    const o = await act(id, userId, action, body);
    return NextResponse.json({ status: o.status });
  } catch (e) {
    if (e instanceof TradeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
