// 구매자-판매자 1:1 채팅(상품별). 참여자만 읽고 쓸 수 있다.
// 순서·읽음은 시각(초 단위)이 아니라 메시지 순번(seq)으로 센다 → 같은 초에 온 메시지도 정확하다.
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import { categories, chatMessages, chatThreads, listings, productModels, users } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const CHAT_BODY_MAX = 500;
export const CHAT_RATE = { count: 30, minutes: 5 };   // 한 사람이 5분에 보낼 수 있는 메시지 수
export const CHAT_START_DAILY_MAX = 20;               // 한 사람이 하루에 새로 열 수 있는 채팅방 수
export const CHAT_REPORT_DAILY_MAX = 20;              // 한 사람이 하루에 할 수 있는 신고 수
export const CHAT_PAGE = 200;                         // 한 번에 돌려주는 메시지 수

export type ChatRole = "buyer" | "seller";
export type ChatMsg = { id: string; seq: number; senderId: string; body: string; createdAt: string };

// param: threadId 채팅방, userId 사용자. return: 참여자면 { thread, role }, 아니면 null
export async function threadFor(threadId: string, userId: string) {
  const thread = await db.query.chatThreads.findFirst({ where: eq(chatThreads.id, threadId) });
  if (!thread) return null;
  if (thread.buyerId === userId) return { thread, role: "buyer" as ChatRole };
  if (thread.sellerId === userId) return { thread, role: "seller" as ChatRole };
  return null;
}

// param: tx 트랜잭션. return: 다음 메시지 순번(전체에서 1씩 증가, 단일 프로세스 동기 트랜잭션이라 겹치지 않음)
export function nextSeqTx(tx: Tx): number {
  return (tx.get<{ n: number | null }>(sql`select max(seq) as n from chat_messages`)?.n ?? 0) + 1;
}

// 상대 메시지 중 내 읽음 커서보다 뒤에 있는 것이 있으면 안 읽음
const UNREAD_SQL = (userId: string) => sql`exists (select 1 from chat_messages m where m.thread_id = t.id and m.sender_id != ${userId}
  and m.seq > case when t.buyer_id = ${userId} then t.buyer_read_seq else t.seller_read_seq end)`;

// param: userId 사용자. return: 안 읽은 메시지가 있는 채팅방 수
export function unreadThreads(userId: string): number {
  return db.get<{ n: number }>(sql`select count(*) as n from chat_threads t
    where (t.buyer_id = ${userId} or t.seller_id = ${userId}) and ${UNREAD_SQL(userId)}`)?.n ?? 0;
}

const other = alias(users, "other_user");

// param: userId 사용자. return: 내 채팅방 목록(최근 메시지 순) — 상품 썸네일·제목·가격, 상대 닉네임, 마지막 메시지, 안 읽음 여부
export async function listThreads(userId: string) {
  const rows = await db
    .select({
      id: chatThreads.id, listingId: listings.id, title: listings.title, buyerId: chatThreads.buyerId,
      otherName: other.nickname, lastMessageAt: chatThreads.lastMessageAt, createdAt: chatThreads.createdAt,
      last: sql<string | null>`(select m.body from chat_messages m where m.thread_id = ${chatThreads.id} order by m.seq desc limit 1)`,
      lastSender: sql<string | null>`(select m.sender_id from chat_messages m where m.thread_id = ${chatThreads.id} order by m.seq desc limit 1)`,
      unread: sql<number>`exists (select 1 from chat_messages m where m.thread_id = ${chatThreads.id} and m.sender_id != ${userId}
        and m.seq > case when ${chatThreads.buyerId} = ${userId} then ${chatThreads.buyerReadSeq} else ${chatThreads.sellerReadSeq} end)`,
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
  return rows.map((r) => ({ ...r, role: (r.buyerId === userId ? "buyer" : "seller") as ChatRole, unread: Boolean(r.unread), lastMine: r.lastSender === userId }));
}

// param: threadId 채팅방, afterSeq 이 순번 다음부터(없으면 최근 200개)
// return: { messages 오래된 순, hasMore 더 가져올 새 메시지가 남았는지 }
export async function messagesOf(threadId: string, afterSeq?: number): Promise<{ messages: ChatMsg[]; hasMore: boolean }> {
  const cols = { id: chatMessages.id, seq: chatMessages.seq, senderId: chatMessages.senderId, body: chatMessages.body, createdAt: chatMessages.createdAt };
  if (afterSeq !== undefined) {
    const rows = await db.select(cols).from(chatMessages)
      .where(and(eq(chatMessages.threadId, threadId), gt(chatMessages.seq, afterSeq)))
      .orderBy(chatMessages.seq).limit(CHAT_PAGE + 1);
    return { messages: rows.slice(0, CHAT_PAGE), hasMore: rows.length > CHAT_PAGE };
  }
  const rows = await db.select(cols).from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(desc(chatMessages.seq)).limit(CHAT_PAGE);
  return { messages: rows.reverse(), hasMore: false };
}

// param: threadId 채팅방, role 읽은 사람 역할, uptoSeq 화면에 보여 준 마지막 순번. 커서는 앞으로만 움직인다.
export function markReadUpTo(threadId: string, role: ChatRole, uptoSeq: number): void {
  if (!(uptoSeq > 0)) return;
  if (role === "buyer") db.update(chatThreads).set({ buyerReadSeq: sql`max(${chatThreads.buyerReadSeq}, ${uptoSeq})` }).where(eq(chatThreads.id, threadId)).run();
  else db.update(chatThreads).set({ sellerReadSeq: sql`max(${chatThreads.sellerReadSeq}, ${uptoSeq})` }).where(eq(chatThreads.id, threadId)).run();
}
