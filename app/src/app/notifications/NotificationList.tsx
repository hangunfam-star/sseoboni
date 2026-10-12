"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Item = { id: string; category: string; title: string; body: string; url: string; read: boolean; when: string };
const LABEL: Record<string, string> = { TRADE: "거래", CHAT: "채팅", INTEREST: "관심", REVIEW: "후기" };

// param: items 알림 목록(최근 순). 누르면 읽음 처리하고 이동, "모두 읽음" 버튼
export function NotificationList({ items }: { items: Item[] }) {
  const [list, setList] = useState(items);
  const router = useRouter();
  const unread = list.filter((x) => !x.read).length;

  async function readAll() {
    setList((l) => l.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
    router.refresh();
  }
  function open(it: Item) {
    if (!it.read) {
      setList((l) => l.map((x) => (x.id === it.id ? { ...x, read: true } : x)));
      void fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [it.id] }), keepalive: true }).catch(() => undefined);
    }
  }

  if (list.length === 0) {
    return <div className="empty-card"><strong>아직 알림이 없어요.</strong><small>거래·채팅·찜한 상품 소식이 생기면 여기에 모여요.</small></div>;
  }
  return (
    <>
      <div className="notifications-bar">
        <span>{unread > 0 ? `안 읽은 알림 ${unread}개` : "모두 읽었어요"}</span>
        {unread > 0 && <button type="button" className="text-button" onClick={readAll}>모두 읽음</button>}
      </div>
      <ul className="notification-list">
        {list.map((it) => (
          <li key={it.id} className={it.read ? "is-read" : undefined}>
            <Link href={it.url} onClick={() => open(it)}>
              <span className={`notification-tag notification-tag--${it.category.toLowerCase()}`}>{LABEL[it.category] ?? "알림"}</span>
              <strong>{it.title}</strong>
              <p>{it.body}</p>
              <small>{it.when}</small>
              {!it.read && <i className="notification-dot" aria-label="안 읽음" />}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
