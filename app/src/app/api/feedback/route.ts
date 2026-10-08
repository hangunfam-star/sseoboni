import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { marketValidationEvents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { FEEDBACK_DAILY_MAX, FEEDBACK_MESSAGE_MAX, FEEDBACK_REASONS, TRY_LATER } from "@/ui/feedback";

// POST /api/feedback { reason, tryLater?, message? } — 이탈 사유·의견(§101-7 인터뷰·이탈사유 기록)
// 별도 테이블 없이 FEEDBACK 이벤트의 metadata(JSON)에 남긴다. 연락처 등 개인정보는 받지 않는다.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const reason = str(body?.reason);
  const tryLater = str(body?.tryLater);
  const message = str(body?.message);
  if (!(FEEDBACK_REASONS as readonly string[]).includes(reason)) return NextResponse.json({ error: "이유를 하나 골라 주세요." }, { status: 400 });
  if (tryLater && !(TRY_LATER as readonly string[]).includes(tryLater)) return NextResponse.json({ error: "답이 올바르지 않습니다." }, { status: 400 });
  if (message.length > FEEDBACK_MESSAGE_MAX) return NextResponse.json({ error: `의견은 ${FEEDBACK_MESSAGE_MAX.toLocaleString()}자 이하로 적어 주세요.` }, { status: 400 });

  const saved = db.transaction((tx) => {
    const today = tx.select({ n: sql<number>`count(*)` }).from(marketValidationEvents)
      .where(and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.eventType, "FEEDBACK"), sql`${marketValidationEvents.createdAt} > datetime('now','-1 day')`))
      .get()?.n ?? 0;
    if (today >= FEEDBACK_DAILY_MAX) return false;
    tx.insert(marketValidationEvents).values({
      eventType: "FEEDBACK",
      userId,
      metadata: JSON.stringify({ reason, tryLater: tryLater || null, message: message || null }),
    }).run();
    return true;
  });
  if (!saved) return NextResponse.json({ error: "오늘은 의견을 충분히 남겨 주셨어요. 내일 다시 남겨 주세요." }, { status: 429 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
