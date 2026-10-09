import type { Metadata } from "next";
import Link from "next/link";
import { ListThumb } from "@/components/ListThumb";
import { getCurrentUserId } from "@/lib/session";
import { listOrders } from "@/lib/orders";
import { formatWon, illustrationKind, relativeTime } from "@/ui/presentation";

export const metadata: Metadata = { title: "내 거래 · 써보니", robots: { index: false, follow: false } };

const TABS = [
  { key: "all", label: "전체" },
  { key: "buyer", label: "산·써본 거래" },
  { key: "seller", label: "판 거래" },
] as const;

// 내 거래 목록 — 진행 중(내 차례 먼저)·끝난 거래
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "all";
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><h1 className="page-title">내 거래</h1><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  const all = await listOrders(userId);
  const rows = all.filter((o) => tab === "all" || o.role === tab).sort((a, b) => Number(b.needsMe) - Number(a.needsMe));
  const live = rows.filter((o) => !["PURCHASED", "RETURNED", "CANCELLED"].includes(o.status));
  const done = rows.filter((o) => ["PURCHASED", "RETURNED", "CANCELLED"].includes(o.status));
  const Item = ({ o }: { o: (typeof rows)[number] }) => (
    <li>
      <Link className="chat-list__item" href={`/orders/${o.id}`}>
        <ListThumb photo={o.photo} seed={o.id} kind={illustrationKind(o.category, o.modelName)} alt={o.title} />
        <span className="chat-list__body">
          <span className="chat-list__top"><em className={`chat-kind chat-kind--${o.role === "buyer" ? "sent" : "received"}`}>{o.role === "buyer" ? (o.kind === "TRIAL" ? "써보기" : "구매") : "판매"}</em><small>{o.statusLabel}</small></span>
          <strong className="chat-list__title">{o.title}</strong>
          <small className="chat-list__price">{formatWon(o.price)}{o.kind === "TRIAL" && o.trialHours ? ` · ${o.trialHours}시간` : ""}</small>
        </span>
        <span className="chat-list__meta"><small>{relativeTime(o.updatedAt)}</small>{o.needsMe && <b className="chat-list__dot" aria-label="내 차례">!</b>}</span>
      </Link>
    </li>
  );
  return (
    <div className="page chats-page">
      <h1 className="page-title">내 거래</h1>
      <nav className="chat-tabs" aria-label="거래 구분">
        {TABS.map((t) => <Link key={t.key} href={t.key === "all" ? "/orders" : `/orders?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>{t.label} {all.filter((o) => t.key === "all" || o.role === t.key).length}</Link>)}
      </nav>
      {rows.length === 0 ? (
        <div className="empty-card"><strong>아직 거래가 없어요.</strong><Link href="/">상품 둘러보기</Link></div>
      ) : (
        <>
          {live.length > 0 && <><h2 className="section-title">진행 중 {live.length}</h2><ul className="chat-list">{live.map((o) => <Item key={o.id} o={o} />)}</ul></>}
          {done.length > 0 && <><h2 className="section-title">끝난 거래 {done.length}</h2><ul className="chat-list">{done.map((o) => <Item key={o.id} o={o} />)}</ul></>}
        </>
      )}
    </div>
  );
}
