import Link from "next/link";
import { listThreads } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { relativeTime } from "@/ui/presentation";

// 채팅 목록 — 내가 구매자·판매자로 참여한 상품별 채팅방
export default async function ChatsPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <div className="page chats-page">
        <h1 className="page-title">채팅</h1>
        <div className="empty-card"><strong>닉네임만 정하면 판매자와 채팅할 수 있어요.</strong><Link href="/login">닉네임 정하고 시작하기</Link></div>
      </div>
    );
  }
  const threads = await listThreads(userId);
  return (
    <div className="page chats-page">
      <h1 className="page-title">채팅</h1>
      <p className="page-lead">연락처·계좌는 주고받을 수 없어요. 써보니 안에서만 이야기해 주세요.</p>
      {threads.length === 0 ? (
        <div className="empty-card"><strong>아직 채팅이 없어요.</strong><Link href="/">상품 둘러보기</Link></div>
      ) : (
        <ul className="chat-list">
          {threads.map((t) => (
            <li key={t.id}>
              <Link className="chat-list__item" href={`/chats/${t.id}`}>
                <span className="chat-list__avatar" aria-hidden="true">{Array.from(t.otherName ?? "?")[0]}</span>
                <span className="chat-list__body">
                  <small>{t.title} · {t.role === "buyer" ? "판매자" : "구매자"} {t.otherName ?? ""}</small>
                  <strong>{t.last ?? "아직 메시지가 없어요"}</strong>
                </span>
                <span className="chat-list__meta">
                  <small>{relativeTime(t.lastMessageAt ?? t.createdAt)}</small>
                  {t.unread && <b className="chat-list__dot" aria-label="안 읽은 메시지">N</b>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
