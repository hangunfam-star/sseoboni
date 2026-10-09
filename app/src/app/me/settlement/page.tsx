import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { sellerAnalysis } from "@/lib/trade-stats";
import { formatWon } from "@/ui/presentation";
import { kst } from "@/ui/trade-rules";
import type { Snapshot } from "@/lib/orders";

export const metadata: Metadata = { title: "판매 정산 내역 · 써보니", robots: { index: false, follow: false } };

// 판매자 정산 내역 — 돈은 구매자에게 직접 받으므로, 여기서는 받은 금액·수수료(베타 0%)·정식이었다면 수수료를 기록으로 보여 준다.
export default async function SettlementPage() {
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><h1 className="page-title"><Icon name="wallet" />판매 정산 내역</h1><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  const rows = await db.select().from(orders).where(and(eq(orders.sellerId, userId), inArray(orders.status, ["PURCHASED", "RETURNED"]))).orderBy(desc(orders.completedAt)).limit(500);
  const items = rows.map((o) => {
    const received = o.status === "PURCHASED" ? o.price + o.shippingFee : (o.trialFee ?? 0) + o.shippingFee; // 반납: 체험료 + 발송비만 남는다
    return { id: o.id, title: (JSON.parse(o.snapshot) as Snapshot).title, kind: o.kind, status: o.status, at: o.completedAt, month: (o.completedAt ?? "").slice(0, 7), price: o.price, received, fee: o.feeAmount ?? 0, virtual: o.virtualFee ?? 0, trialFee: o.trialFee ?? 0 };
  });
  const months = [...new Set(items.map((i) => i.month))];
  const a = await sellerAnalysis(userId);

  return (
    <div className="page settlement-page">
      <div className="page-top"><Link className="icon-button" href="/me" aria-label="MY로"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></Link></div>
      <h1 className="page-title"><Icon name="wallet" />판매 정산 내역</h1>
      <p className="page-lead">대금은 구매자가 내 계좌로 직접 보내요. 써보니 수수료는 베타 기간에 받지 않고, 정식이었다면 낼 금액만 기록해요. 반납 수수료는 없어요.</p>

      {items.length === 0 ? <div className="empty-card"><strong>아직 끝난 거래가 없어요.</strong><Link href="/orders?tab=seller">진행 중인 판매 보기</Link></div> : months.map((m) => {
        const list = items.filter((i) => i.month === m);
        const sum = (k: "received" | "fee" | "virtual") => list.reduce((s, i) => s + i[k], 0);
        return (
          <section key={m} className="order-box">
            <h2><Icon name="won" />{m.replace("-", "년 ")}월 · {list.length}건</h2>
            <dl className="order-dl">
              <div><dt>받은 금액 합계</dt><dd>{formatWon(sum("received"))}</dd></div>
              <div><dt>써보니 수수료</dt><dd>{formatWon(sum("fee"))} <small>정식이었다면 {formatWon(sum("virtual"))}</small></dd></div>
            </dl>
            <ul className="settle-list">
              {list.map((i) => (
                <li key={i.id}><Link href={`/orders/${i.id}`}>
                  <span><strong>{i.title}</strong><small>{kst(i.at)} · {i.status === "PURCHASED" ? (i.kind === "TRIAL" ? "써보고 구매" : "구매") : `반납 · 체험료 ${formatWon(i.trialFee)}`}</small></span>
                  <span><b>{formatWon(i.received)}</b><small>수수료 {formatWon(i.fee)}</small></span>
                </Link></li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="order-box" aria-labelledby="analysis-title">
        <h2 id="analysis-title"><Icon name="chart" />써보기 분석 <small>(나만 보는 자료 · 최근 {a.days}일)</small></h2>
        {a.total === 0 ? <p className="field-hint">데이터 없음 · 써보기 거래가 끝나면 보여 드려요.</p> : (
          <>
            <p>써보고 구매 {a.bought}건 · 반납 {a.returned}건{a.total >= 5 && a.conversion !== null ? ` · 구매 전환 ${Math.round(a.conversion * 100)}%` : " (5건부터 비율을 보여 드려요)"}</p>
            {a.reasons.length > 0 && <ul className="component-list">{a.reasons.map((r) => <li key={r.key}>{r.label} {r.count}</li>)}</ul>}
            {a.tips.map((t) => <p key={t} className="field-hint">💡 {t}</p>)}
          </>
        )}
        <p className="field-hint">이 자료는 등급·신뢰·검색 노출과 연결되지 않아요.</p>
      </section>
    </div>
  );
}
