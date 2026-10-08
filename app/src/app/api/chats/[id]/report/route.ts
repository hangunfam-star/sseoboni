import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chatMessages, marketValidationEvents } from "@/db/schema";
import { threadFor } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";

const REASONS = ["욕설·비방", "직거래·외부 연락 유도", "사기 의심", "기타"] as const;

// POST /api/chats/[id]/report { reason, messageId? } — 참여자만. 신고는 운영자 화면에서 확인한다.
// 신고한 메시지 본문만 운영자가 볼 수 있게 함께 기록한다(채팅 전체는 기록하지 않음).
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
  await db.insert(marketValidationEvents).values({
    eventType: "CHAT_REPORTED", listingId: t.thread.listingId, userId,
    metadata: JSON.stringify({ threadId: id, reason, messageId, reportedUserId: msg?.senderId ?? (t.role === "buyer" ? t.thread.sellerId : t.thread.buyerId), body: msg?.body ?? null }),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
