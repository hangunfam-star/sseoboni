import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { chatMessages, marketValidationEvents } from "@/db/schema";
import { CHAT_REPORT_DAILY_MAX, threadFor } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";

const REASONS = ["욕설·비방", "직거래·외부 연락 유도", "사기 의심", "기타"] as const;

// POST /api/chats/[id]/report { reason, messageId? } — 참여자만. 같은 메시지 중복 신고는 한 번만, 하루 20건까지.
// 기록에는 메시지 id만 남기고 본문은 복사하지 않는다(운영자 화면이 신고된 메시지만 원본에서 읽어 보여 준다).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const t = await threadFor(id, userId);
  if (!t) return NextResponse.json({ error: "채팅을 찾을 수 없습니다." }, { status: 404 });
  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason : "";
  if (!(REASONS as readonly string[]).includes(reason)) return NextResponse.json({ error: "신고 이유를 골라 주세요." }, { status: 400 });
  const messageId = typeof body?.messageId === "string" ? body.messageId : null;
  const msg = messageId
    ? await db.query.chatMessages.findFirst({ where: and(eq(chatMessages.id, messageId), eq(chatMessages.threadId, id)) })
    : undefined;
  if (messageId && (!msg || msg.senderId === userId)) return NextResponse.json({ error: "신고할 메시지를 찾을 수 없습니다." }, { status: 404 });

  const result = db.transaction((tx) => {
    const today = tx.select({ n: sql<number>`count(*)` }).from(marketValidationEvents)
      .where(and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.eventType, "CHAT_REPORTED"), sql`${marketValidationEvents.createdAt} > datetime('now','-1 day')`)).get()?.n ?? 0;
    if (today >= CHAT_REPORT_DAILY_MAX) return "LIMIT" as const;
    if (messageId) {
      const dup = tx.select({ id: marketValidationEvents.id }).from(marketValidationEvents)
        .where(and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.eventType, "CHAT_REPORTED"), sql`json_extract(${marketValidationEvents.metadata}, '$.messageId') = ${messageId}`)).get();
      if (dup) return "DUP" as const;
    }
    tx.insert(marketValidationEvents).values({
      eventType: "CHAT_REPORTED", listingId: t.thread.listingId, userId,
      metadata: JSON.stringify({ threadId: id, reason, messageId, reportedUserId: msg?.senderId ?? (t.role === "buyer" ? t.thread.sellerId : t.thread.buyerId) }),
    }).run();
    return "OK" as const;
  });
  if (result === "LIMIT") return NextResponse.json({ error: "오늘은 신고를 충분히 하셨어요. 내일 다시 해 주세요." }, { status: 429 });
  if (result === "DUP") return NextResponse.json({ ok: true, duplicate: true });
  return NextResponse.json({ ok: true }, { status: 201 });
}
