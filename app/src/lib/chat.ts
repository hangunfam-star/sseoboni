// 구매자-판매자 1:1 채팅(상품별). 참여자만 읽고 쓸 수 있다.
import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import { categories, chatMessages, chatThreads, listings, productModels, users } from "@/db/schema";

export const CHAT_BODY_MAX = 500;
export const CHAT_RATE = { count: 30, minutes: 5 }; // 한 사람이 5분에 보낼 수 있는 메시지 수

export type ChatRole = "buyer" | "seller";

// param: threadId 채팅방, userId 사용자. return: 참여자면 { thread, role }, 아니면 null
export async function threadFor(threadId: string, userId: string) {
  const thread = await db.query.chatThreads.findFirst({ where: eq(chatThreads.id, threadId) });
  if (!thread) return null;
  if (thread.buyerId === userId) return { thread, role: "buyer" as ChatRole };
  if (thread.sellerId === userId) return { thread, role: "seller" as ChatRole };
  return null;
}

// param: userId 사용자. return: 안 읽은 메시지가 있는 채팅방 수
export function unreadThreads(userId: string): number {
  return db.get<{ n: number }>(sql`select count(*) as n from chat_threads t
    where t.last_message_at is not null and (
      (t.buyer_id = ${userId} and (t.buyer_read_at is null or t.buyer_read_at < t.last_message_at)
        and exists (select 1 from chat_messages m where m.thread_id = t.id and m.sender_id != ${userId} and (t.buyer_read_at is null or m.created_at > t.buyer_read_at)))
      or (t.seller_id = ${userId} and (t.seller_read_at is null or t.seller_read_at < t.last_message_at)
        and exists (select 1 from chat_messages m where m.thread_id = t.id and m.sender_id != ${userId} and (t.seller_read_at is null or m.created_at > t.seller_read_at)))
    )`)?.n ?? 0;
}

const other = alias(users, "other_user");

// param: userId 사용자. return: 내 채팅방 목록(최근 메시지 순) — 상품 제목, 상대 닉네임, 마지막 메시지, 안 읽음 여부
export async function listThreads(userId: string) {
  const rows = await db
    .select({
      id: chatThreads.id, listingId: listings.id, title: listings.title, buyerId: chatThreads.buyerId,
      otherName: other.nickname, lastMessageAt: chatThreads.lastMessageAt, createdAt: chatThreads.createdAt,
      buyerReadAt: chatThreads.buyerReadAt, sellerReadAt: chatThreads.sellerReadAt,
      last: sql<string | null>`(select m.body from chat_messages m where m.thread_id = ${chatThreads.id} order by m.created_at desc, m.rowid desc limit 1)`,
      lastSender: sql<string | null>`(select m.sender_id from chat_messages m where m.thread_id = ${chatThreads.id} order by m.created_at desc, m.rowid desc limit 1)`,
      price: listings.price, listingStatus: listings.status, modelName: productModels.modelName, categoryName: categories.name,
      photo: sql<string | null>`(select p.file_name from listing_photos p where p.listing_id = ${listings.id} order by p.sort_order, p.created_at limit 1)`,
    })
    .from(chatThreads)
    .innerJoin(listings, eq(chatThreads.listingId, listings.id))
    .leftJoin(productModels, eq(listings.modelId, productModels.id))
    .leftJoin(categories, eq(productModels.categoryId, categories.id))
    .leftJoin(other, sql`${other.id} = case when ${chatThreads.buyerId} = ${userId} then ${chatThreads.sellerId} else ${chatThreads.buyerId} end`)
    .where(or(eq(chatThreads.buyerId, userId), eq(chatThreads.sellerId, userId)))
    .orderBy(desc(sql`coalesce(${chatThreads.lastMessageAt}, ${chatThreads.createdAt})`))
    .limit(50);
  return rows.map((r) => {
    const readAt = r.buyerId === userId ? r.buyerReadAt : r.sellerReadAt;
    const unread = Boolean(r.lastMessageAt && r.lastSender && r.lastSender !== userId && (!readAt || readAt < r.lastMessageAt));
    return { ...r, role: (r.buyerId === userId ? "buyer" : "seller") as ChatRole, unread, lastMine: r.lastSender === userId };
  });
}

// param: threadId 채팅방, afterId 이 메시지 다음부터(없으면 처음부터 최근 200개)
// return: 메시지 목록(오래된 순)
export async function messagesOf(threadId: string, afterCreatedAt?: string) {
  const rows = await db
    .select({ id: chatMessages.id, senderId: chatMessages.senderId, body: chatMessages.body, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(and(eq(chatMessages.threadId, threadId), afterCreatedAt ? sql`${chatMessages.createdAt} >= ${afterCreatedAt}` : undefined))
    .orderBy(desc(chatMessages.createdAt), sql`rowid desc`)
    .limit(200);
  return rows.reverse();
}

// param: threadId 채팅방, role 읽은 사람 역할. 지금 시각으로 읽음 표시
export function markRead(threadId: string, role: ChatRole): void {
  db.update(chatThreads)
    .set(role === "buyer" ? { buyerReadAt: sql`(current_timestamp)` } : { sellerReadAt: sql`(current_timestamp)` })
    .where(eq(chatThreads.id, threadId))
    .run();
}
