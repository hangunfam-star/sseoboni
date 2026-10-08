import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { chatMessages, chatThreads, listings, marketValidationEvents } from "@/db/schema";
import { CHAT_BODY_MAX, CHAT_RATE, markReadUpTo, messagesOf, nextSeqTx, threadFor } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { findContactInfo } from "@/ui/trial-pricing";

// GET /api/chats/[id]?after=순번 — 참여자만. after 다음 메시지를 순번 순으로(최대 200개, hasMore로 남은 것 알림).
// 읽음은 돌려준 메시지 중 마지막 순번까지만 표시한다(보여 주지 않은 메시지는 읽음 처리하지 않음).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const t = await threadFor(id, userId);
  if (!t) return NextResponse.json({ error: "채팅을 찾을 수 없습니다." }, { status: 404 });
  const raw = req.nextUrl.searchParams.get("after");
  const after = raw !== null && /^\d{1,15}$/.test(raw) ? Number(raw) : undefined;
  const { messages, hasMore } = await messagesOf(id, after);
  if (messages.length > 0) markReadUpTo(id, t.role, messages[messages.length - 1].seq);
  return NextResponse.json({ messages, hasMore, me: userId, role: t.role });
}

// POST /api/chats/[id] { body } — 참여자만 보낸다. 연락처·계좌는 막고, 5분에 30개까지.
// 보낸다고 해서 상대 메시지를 읽음 처리하지 않는다(읽음은 화면에 보여 줄 때만).
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
    const msg = tx.insert(chatMessages).values({ threadId: id, seq: nextSeqTx(tx), senderId: userId, body: text }).returning().get();
    tx.update(chatThreads).set({ lastMessageAt: msg.createdAt }).where(eq(chatThreads.id, id)).run();
    // 내 메시지는 내 읽음 커서에 영향을 주지 않는다(내 메시지는 안 읽음 계산에서 빠짐).
    // 시장검증 기록에는 메시지 본문을 남기지 않는다(개인정보 최소화).
    tx.insert(marketValidationEvents).values({ eventType: "CHAT_MESSAGE_SENT", listingId: t.thread.listingId, modelId: listing?.modelId, userId, metadata: JSON.stringify({ threadId: id, role: t.role, length: text.length }) }).run();
    return msg;
  });
  if (!saved) return NextResponse.json({ error: "메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요." }, { status: 429 });
  return NextResponse.json({ message: { id: saved.id, seq: saved.seq, senderId: saved.senderId, body: saved.body, createdAt: saved.createdAt } }, { status: 201 });
}
