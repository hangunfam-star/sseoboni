import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import { receivedReviews, sentReviews, trialReviewsOf } from "@/lib/reviews";
import { relativeTime } from "@/ui/presentation";

export const metadata: Metadata = { title: "내 후기 · 써보니", robots: { index: false, follow: false } };

const TABS = [
  { key: "received", label: "받은 후기" },
  { key: "sent", label: "보낸 후기" },
  { key: "trial", label: "써보니 후기" },
] as const;

// 내 후기 — 받은 평가(공개된 것만), 보낸 평가, 써보니 후기(내가 쓴 것 + 내 상품에 달린 것)
export default async function MyReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "received";
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><h1 className="page-title"><Icon name="star" />내 후기</h1><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  const received = tab === "received" ? await receivedReviews(userId) : [];
  const sent = tab === "sent" ? await sentReviews(userId) : [];
  const trialMine = tab === "trial" ? await trialReviewsOf(userId, "writer") : [];
  const trialOnMine = tab === "trial" ? await trialReviewsOf(userId, "seller") : [];
  return (
    <div className="page chats-page">
      <div className="page-top"><Link className="icon-button" href="/me" aria-label="MY로"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></Link></div>
      <h1 className="page-title"><Icon name="star" />내 후기</h1>
      <nav className="chat-tabs" aria-label="후기 구분">
        {TABS.map((t) => <Link key={t.key} href={t.key === "received" ? "/me/reviews" : `/me/reviews?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>{t.label}</Link>)}
      </nav>
      {tab === "received" && (received.length === 0 ? <p className="field-hint">공개된 받은 평가가 없어요. 상대가 평가를 남기고 나도 남기거나 7일이 지나면 보여요.</p> : (
        <ul className="review-list">{received.map((r) => (
          <li key={r.id}><strong>★{r.stars} <small>{r.direction === "B2S" ? "판매자로서" : "구매자로서"} · {r.writer}</small></strong><p>{r.chips.join(" · ")}</p>{r.sample && <p>“{r.sample}”</p>}{r.body && <p>{r.body}</p>}<small>{r.title} · {relativeTime(r.createdAt)}</small></li>
        ))}</ul>
      ))}
      {tab === "sent" && (sent.length === 0 ? <p className="field-hint">아직 남긴 평가가 없어요. 거래가 끝나면 거래 화면에서 남길 수 있어요.</p> : (
        <ul className="review-list">{sent.map((r) => (
          <li key={r.id}><strong>★{r.stars} <small>{r.target}님에게</small></strong><p>{r.chips.join(" · ")}</p>{r.body && <p>{r.body}</p>}<small>{r.title} · {relativeTime(r.createdAt)}</small></li>
        ))}</ul>
      ))}
      {tab === "trial" && (
        <>
          <h2 className="section-title"><Icon name="sparkle" />내가 쓴 써보니 후기 {trialMine.length}</h2>
          {trialMine.length === 0 ? <p className="field-hint">써보기 거래가 끝나면 남길 수 있어요.</p> : <ul className="review-list">{trialMine.map((r) => <li key={r.id}><strong>{r.title}</strong><small className="trial-cert">체험 거래 인증 · {r.hours}시간 · {r.outcome === "PURCHASED" ? "써보고 샀어요" : "써보고 돌려보냈어요"}</small>{r.learned && <p>“{r.learned}”</p>}{r.answers.map((a) => <p key={a.q}><b>{a.q}</b> {a.a}</p>)}</li>)}</ul>}
          <h2 className="section-title"><Icon name="quote" />내 상품에 달린 써보니 후기 {trialOnMine.length}</h2>
          {trialOnMine.length === 0 ? <p className="field-hint">아직 없어요.</p> : <ul className="review-list">{trialOnMine.map((r) => <li key={r.id}><strong>{r.title} <small>· {r.writer}</small></strong><small className="trial-cert">체험 거래 인증 · {r.hours}시간 · {r.outcome === "PURCHASED" ? "써보고 샀어요" : "써보고 돌려보냈어요"}</small>{r.learned && <p>“{r.learned}”</p>}{r.reason && <p>이유: {r.reason}</p>}</li>)}</ul>}
        </>
      )}
    </div>
  );
}
