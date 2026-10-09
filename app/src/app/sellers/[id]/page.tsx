import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { ProductCard } from "@/components/ProductCard";
import { listCards } from "@/lib/queries";
import { receivedReviews, starSummary, trialReviewsOf } from "@/lib/reviews";
import { completedAsSeller, gradesOf, sellerTrust } from "@/lib/trade-stats";
import { relativeTime } from "@/ui/presentation";
import { ratioText } from "@/ui/trade-rules";

export const metadata: Metadata = { title: "판매자 채널 · 써보니" };

const TABS = [
  { key: "items", label: "판매 상품" },
  { key: "reviews", label: "받은 후기" },
  { key: "trial", label: "써보니 후기" },
] as const;

// 판매자 채널 — 활동 등급, 확인된 신뢰 기록(횟수·기간), 받은 후기, 써보니 후기, 판매 상품
export default async function SellerChannelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "items";
  const seller = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!seller || seller.status !== "ACTIVE") notFound();
  const name = seller.nickname ?? "판매자";
  const grades = await gradesOf(id);
  const stars = await starSummary(id);
  const trust = await sellerTrust(id);
  const done = completedAsSeller(id);
  const items = tab === "items" ? await listCards({ sellerId: id, limit: 60 }) : [];
  const reviews = tab === "reviews" ? await receivedReviews(id, "B2S") : [];
  const trials = tab === "trial" ? await trialReviewsOf(id, "seller") : [];

  return (
    <div className="page seller-page">
      <div className="page-top"><Link className="icon-button" href="/" aria-label="홈으로"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></Link></div>
      <header className="my-header">
        <span className="seller-avatar seller-avatar--lg" aria-hidden="true">{Array.from(name)[0]}</span>
        <div>
          <h1 className="page-title">{name}</h1>
          <p className="grade-line"><span className="grade-badge-inline"><Icon name="store" />판매 {grades.seller.name}</span><span className="grade-badge-inline grade-badge-inline--soft"><Icon name="bag" />구매 {grades.buyer.name}</span>{stars.asSeller && <span>★{stars.asSeller.avg} ({stars.asSeller.count})</span>}</p>
        </div>
      </header>
      <section className="order-box" aria-labelledby="trust-title">
        <h2 id="trust-title"><Icon name="shield" />거래 기록 <small>(최근 {trust.days}일)</small></h2>
        <dl className="order-dl">
          <div><dt>발송 약속 준수</dt><dd>{ratioText(trust.shipPromise.done, trust.shipPromise.total)} <small>확인된 기록</small></dd></div>
          <div><dt>설명과 실제 일치</dt><dd>{ratioText(trust.descMatch.done, trust.descMatch.total)} <small>구매자 평가</small></dd></div>
          <div><dt>구성품 안내 정확</dt><dd>{ratioText(trust.compMatch.done, trust.compMatch.total)} <small>구매자 평가</small></dd></div>
          <div><dt>끝난 거래</dt><dd>구매 완료 {done.bought ?? 0}건 · 반납 완료 {done.returned ?? 0}건</dd></div>
        </dl>
        <p className="field-hint">활동 등급은 거래 경험을 나타내고, 신뢰를 보장하지는 않아요. 정상 반납은 감점하지 않아요.</p>
      </section>
      <nav className="chat-tabs" aria-label="채널 구분">
        {TABS.map((t) => <Link key={t.key} href={t.key === "items" ? `/sellers/${id}` : `/sellers/${id}?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>{t.label}</Link>)}
      </nav>
      {tab === "items" && (items.length === 0 ? <p className="field-hint">판매 중인 상품이 없어요.</p> : <div className="product-grid">{items.map((r) => <ProductCard key={r.id} {...r} />)}</div>)}
      {tab === "reviews" && (reviews.length === 0 ? <p className="field-hint">공개된 후기가 없어요.</p> : (
        <ul className="review-list">{reviews.map((r) => <li key={r.id}><strong>★{r.stars} <small>{r.writer}</small></strong><p>{r.chips.join(" · ")}</p>{r.sample && <p>“{r.sample}”</p>}{r.body && <p>{r.body}</p>}<small>{r.title} · {relativeTime(r.createdAt)}</small></li>)}</ul>
      ))}
      {tab === "trial" && (trials.length === 0 ? <p className="field-hint">아직 써보니 후기가 없어요.</p> : (
        <ul className="review-list">{trials.map((r) => <li key={r.id}><strong>{r.title} <small>{r.writer}</small></strong><small className="trial-cert">체험 거래 인증 · 체험 기간 {r.hours}시간 · {r.outcome === "PURCHASED" ? "써보고 샀어요" : "써보고 돌려보냈어요"}</small>{r.learned && <p>“{r.learned}”</p>}{r.answers.map((a) => <p key={a.q}><b>{a.q}</b> {a.a}</p>)}{r.fitFor && <p>어울리는 분: {r.fitFor}</p>}</li>)}</ul>
      ))}
    </div>
  );
}
