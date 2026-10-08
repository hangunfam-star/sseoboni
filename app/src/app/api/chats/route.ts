import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chatThreads, listings, marketValidationEvents } from "@/db/schema";
import { listThreads, unreadThreads } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";

// GET /api/chats — 내 채팅방 목록과 안 읽은 채팅방 수
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ threads: [], unread: 0 });
  return NextResponse.json({ threads: await listThreads(userId), unread: unreadThreads(userId) });
}

// POST /api/chats { listingId } — 구매자가 판매자에게 말 걸기. 있으면 기존 채팅방을 돌려준다(상품·구매자당 1개).
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "닉네임을 정하고 시작하면 채팅할 수 있어요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  const listing = listingId ? await db.query.listings.findFirst({ where: eq(listings.id, listingId) }) : undefined;
  if (!listing) return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  if (listing.sellerId === userId) return NextResponse.json({ error: "내 상품에는 채팅을 시작할 수 없어요. 구매자가 말을 걸면 MY·채팅에서 답할 수 있어요." }, { status: 400 });

  const result = db.transaction((tx) => {
    const existing = tx.select().from(chatThreads).where(and(eq(chatThreads.listingId, listingId), eq(chatThreads.buyerId, userId))).get();
    if (existing) return { thread: existing, created: false };
    if (listing.status !== "ACTIVE") return null; // 판매 중이 아닌 상품에는 새 채팅을 열지 않는다(기존 채팅은 계속 가능)
    const thread = tx.insert(chatThreads).values({ listingId, buyerId: userId, sellerId: listing.sellerId }).returning().get();
    tx.insert(marketValidationEvents).values({ eventType: "CHAT_STARTED", listingId, modelId: listing.modelId, userId }).run();
    return { thread, created: true };
  });
  if (!result) return NextResponse.json({ error: "판매 중인 상품에만 새 채팅을 열 수 있어요." }, { status: 409 });
  return NextResponse.json({ threadId: result.thread.id, created: result.created }, { status: result.created ? 201 : 200 });
}
