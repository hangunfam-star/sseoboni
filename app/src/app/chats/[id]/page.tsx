import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, users } from "@/db/schema";
import { markRead, messagesOf, threadFor } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { formatWon } from "@/ui/presentation";
import { ChatRoom } from "./ChatRoom";

// 채팅방 — 참여자(구매자·판매자)만 볼 수 있다.
export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return <div className="page"><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  }
  const t = await threadFor(id, userId);
  if (!t) notFound();
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, t.thread.listingId) });
  const otherId = t.role === "buyer" ? t.thread.sellerId : t.thread.buyerId;
  const other = await db.query.users.findFirst({ where: eq(users.id, otherId) });
  const messages = await messagesOf(id);
  markRead(id, t.role);

  return (
    <div className="chat-page">
      <header className="chat-head">
        <Link className="icon-button" href="/chats" aria-label="채팅 목록">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <div>
          <strong>{other?.nickname ?? (t.role === "buyer" ? "판매자" : "구매자")}</strong>
          {listing && <Link href={`/listings/${listing.id}`}><small>{listing.title} · {formatWon(listing.price)}</small></Link>}
        </div>
      </header>
      <ChatRoom threadId={id} me={userId} initial={messages} otherName={other?.nickname ?? (t.role === "buyer" ? "판매자" : "구매자")} />
    </div>
  );
}
