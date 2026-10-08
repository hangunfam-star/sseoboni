import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { chatMessages, chatThreads, listings, marketValidationEvents } from "@/db/schema";
import { CHAT_BODY_MAX, CHAT_RATE, markRead, messagesOf, threadFor } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { findContactInfo } from "@/ui/trial-pricing";

// GET /api/chats/[id]?after=시각 — 참여자만. 메시지를 돌려주고 읽음 표시한다.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const t = await threadFor(id, userId);
  if (!t) return NextResponse.json({ error: "채팅을 찾을 수 없습니다." }, { status: 404 });
  const after = req.nextUrl.searchParams.get("after") ?? undefined;
  const messages = await messagesOf(id, after && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(after) ? after : undefined);
  markRead(id, t.role);
  return NextResponse.json({ messages, me: userId, role: t.role });
}

// POST /api/chats/[id] { body } — 참여자만 보낸다. 연락처·계좌는 막고, 5분에 30개까지.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const t = await threadFor(id, userId);
  if (!t) return NextResponse.json({ error: "채팅을 찾을 수 없습니다." }, { status: 404 });
  const payload = await req.json().catch(() => null);
  const text = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!text) return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  if (text.length > CHAT_BODY_MAX) return NextResponse.json({ error: `메시지는 ${CHAT_BODY_MAX}자 이하로 보내 주세요.` }, { status: 400 });
  const contact = findContactInfo(text);
  if (contact) return NextResponse.json({ error: `${contact}는 채팅으로 주고받을 수 없어요. 안전을 위해 써보니 안에서만 이야기해 주세요.` }, { status: 400 });

  const listing = await db.query.listings.findFirst({ where: eq(listings.id, t.thread.listingId) });
  const saved = db.transaction((tx) => {
    const recent = tx.select({ n: sql<number>`count(*)` }).from(chatMessages)
      .where(and(eq(chatMessages.senderId, userId), sql`${chatMessages.createdAt} > datetime('now', ${`-${CHAT_RATE.minutes} minutes`})`)).get()?.n ?? 0;
    if (recent >= CHAT_RATE.count) return null;
    const msg = tx.insert(chatMessages).values({ threadId: id, senderId: userId, body: text }).returning().get();
    tx.update(chatThreads).set({
      lastMessageAt: msg.createdAt,
      ...(t.role === "buyer" ? { buyerReadAt: msg.createdAt } : { sellerReadAt: msg.createdAt }),
    }).where(eq(chatThreads.id, id)).run();
    // 시장검증 기록에는 메시지 본문을 남기지 않는다(개인정보 최소화).
    tx.insert(marketValidationEvents).values({ eventType: "CHAT_MESSAGE_SENT", listingId: t.thread.listingId, modelId: listing?.modelId, userId, metadata: JSON.stringify({ threadId: id, role: t.role, length: text.length }) }).run();
    return msg;
  });
  if (!saved) return NextResponse.json({ error: "메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요." }, { status: 429 });
  return NextResponse.json({ message: { id: saved.id, senderId: saved.senderId, body: saved.body, createdAt: saved.createdAt } }, { status: 201 });
}
