import Link from "next/link";
import { ListThumb } from "@/components/ListThumb";
import { listThreads } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { formatWon, illustrationKind, relativeTime } from "@/ui/presentation";

const TABS = [
  { key: "all", label: "전체" },
  { key: "sent", label: "보낸 채팅" },     // 내가 구매자로 판매자에게 말을 건 채팅
  { key: "received", label: "받은 채팅" }, // 내 상품에 구매자가 말을 건 채팅
] as const;

// 채팅 목록 — 상품 썸네일·상품명, 보낸/받은 채팅 구분
export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "all";
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <div className="page chats-page">
        <h1 className="page-title">채팅</h1>
        <div className="empty-card"><strong>닉네임만 정하면 판매자와 채팅할 수 있어요.</strong><Link href="/login">닉네임 정하고 시작하기</Link></div>
      </div>
    );
  }
  const all = await listThreads(userId);
  const threads = all.filter((t) => tab === "all" || (tab === "sent" ? t.role === "buyer" : t.role === "seller"));
  const count = (k: string) => all.filter((t) => k === "all" || (k === "sent" ? t.role === "buyer" : t.role === "seller")).length;
  const unread = (k: string) => all.filter((t) => t.unread && (k === "all" || (k === "sent" ? t.role === "buyer" : t.role === "seller"))).length;

  return (
    <div className="page chats-page">
      <h1 className="page-title">채팅</h1>
      <nav className="chat-tabs" aria-label="채팅 구분">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === "all" ? "/chats" : `/chats?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>
            {t.label} {count(t.key)}{unread(t.key) > 0 && <b aria-label={`안 읽음 ${unread(t.key)}`}>{unread(t.key)}</b>}
          </Link>
        ))}
      </nav>
      <p className="page-lead">연락처·계좌는 주고받을 수 없어요. 써보니 안에서만 이야기해 주세요.</p>
      {threads.length === 0 ? (
        <div className="empty-card">
          <strong>{tab === "received" ? "내 상품에 온 채팅이 아직 없어요." : tab === "sent" ? "아직 판매자에게 보낸 채팅이 없어요." : "아직 채팅이 없어요."}</strong>
          <Link href="/">상품 둘러보기</Link>
        </div>
      ) : (
        <ul className="chat-list">
          {threads.map((t) => (
            <li key={t.id}>
              <Link className="chat-list__item" href={`/chats/${t.id}`}>
                <ListThumb photo={t.photo} seed={t.listingId} kind={illustrationKind(t.categoryName, t.modelName)} alt={t.title} />
                <span className="chat-list__body">
                  <span className="chat-list__top">
                    <em className={`chat-kind chat-kind--${t.role === "buyer" ? "sent" : "received"}`}>{t.role === "buyer" ? "보낸 채팅" : "받은 채팅"}</em>
                    <small>{t.role === "buyer" ? "판매자" : "구매자"} {t.otherName ?? ""}</small>
                  </span>
                  <strong className="chat-list__title">{t.title}</strong>
                  <small className="chat-list__last">{t.last ? `${t.lastMine ? "나: " : ""}${t.last}` : "아직 메시지가 없어요"}</small>
                  <small className="chat-list__price">{formatWon(t.price)}{t.listingStatus !== "ACTIVE" ? " · 판매 종료" : ""}</small>
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
