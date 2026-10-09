import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { marketValidationEvents } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { resolveDispute, TradeError } from "@/lib/orders";
import { saveTradeSettings } from "@/lib/trade-settings-store";
import { parseTradeSettings } from "@/ui/trade-rules";

// POST /api/admin/trade — 운영자만.
//  { op: "SETTINGS", settings } 거래 설정 저장(거래 열기 포함, 바꾼 기록을 남긴다)
//  { op: "RESOLVE", disputeId, resolution, buyerFault, refundAmount? } 분쟁 정리
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "운영자만 할 수 있어요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    if (body?.op === "SETTINGS") {
      const parsed = parseTradeSettings(body.settings);
      if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
      const saved = await saveTradeSettings(parsed);
      await db.insert(marketValidationEvents).values({ eventType: "TRADE_SETTINGS_CHANGED", metadata: JSON.stringify(saved) });
      return NextResponse.json({ settings: saved });
    }
    if (body?.op === "RESOLVE") {
      if (typeof body.disputeId !== "string" || typeof body.resolution !== "string" || typeof body.buyerFault !== "boolean") return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
      const amount = body.refundAmount === undefined || body.refundAmount === null || body.refundAmount === "" ? undefined : Number(body.refundAmount);
      await resolveDispute(body.disputeId, body.resolution, body.buyerFault, amount);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  } catch (e) {
    if (e instanceof TradeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
