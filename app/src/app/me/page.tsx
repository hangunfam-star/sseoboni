import Link from "next/link";
import { alias } from "drizzle-orm/sqlite-core";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, demandIntents, listings, productModels, trialProposals, users, wishlists } from "@/db/schema";
import { expireOldProposals, getTrialTerms } from "@/lib/trial-terms";
import { ProposalActions } from "./ProposalActions";
import { ChatStartButton } from "@/components/ChatStartButton";
import { unreadThreads } from "@/lib/chat";
import { chatThreads } from "@/db/schema";
import { ListThumb } from "@/components/ListThumb";
import { getCurrentUserId } from "@/lib/session";
import { conditionLabel, formatWon, illustrationKind, relativeTime } from "@/ui/presentation";
import { ListingStatusActions, LogoutButton } from "./MyActions";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "판매 중", HIDDEN: "숨김", SOLD: "판매완료" };
const PROPOSAL_LABEL: Record<string, string> = { PENDING: "답 기다리는 중", ACCEPTED: "승인", DECLINED: "거절", CANCELLED: "취소됨", EXPIRED: "만료" };
const buyers = alias(users, "buyers");
// 내 판매 상품 탭: 판매 중 / 숨김 / 판매완료. 한 번에 30개씩, 더 보기로 늘린다.
const LISTING_TABS = [
  { key: "active", status: "ACTIVE", label: "판매 중", empty: "판매 중인 상품이 없어요." },
  { key: "hidden", status: "HIDDEN", label: "숨김", empty: "숨긴 상품이 없어요." },
  { key: "sold", status: "SOLD", label: "판매완료", empty: "판매완료한 상품이 없어요." },
] as const;
const MY_PAGE_SIZE = 30;

export default async function MyPage({ searchParams }: { searchParams: Promise<{ tab?: string; n?: string }> }) {
  const { tab: rawTab, n } = await searchParams;
  const tab = LISTING_TABS.find((t) => t.key === rawTab) ?? LISTING_TABS[0];
  const shown = Math.min(Math.max(Number.parseInt(n ?? "1", 10) || 1, 1), 50) * MY_PAGE_SIZE;
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <div className="page my-page">
        <h1 className="page-title">MY</h1>
        <div className="empty-card">
          <strong>닉네임만 정하면 내 판매 상품과 찜을 모아볼 수 있어요.</strong>
          <Link href="/login">닉네임 정하고 시작하기</Link>
        </div>
      </div>
    );
  }

  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
  expireOldProposals();
  // 받은 제안: 내 상품에 온 제안(답 기다리는 것 먼저), 보낸 제안: 내가 보낸 것
  const pendingFirst = sql`case when ${trialProposals.status} = 'PENDING' then 0 else 1 end`;
  const received = await db
    .select({ id: trialProposals.id, listingId: listings.id, buyerId: trialProposals.buyerId, title: listings.title, price: listings.price, hours: trialProposals.hours, offerFee: trialProposals.offerFee, message: trialProposals.message, status: trialProposals.status, sellerReply: trialProposals.sellerReply, buyer: buyers.nickname, createdAt: trialProposals.createdAt })
    .from(trialProposals).innerJoin(listings, eq(trialProposals.listingId, listings.id)).leftJoin(buyers, eq(trialProposals.buyerId, buyers.id))
    .where(eq(listings.sellerId, userId)).orderBy(pendingFirst, desc(trialProposals.createdAt)).limit(30);
  const sellerTerms = new Map(await Promise.all([...new Set(received.map((r) => r.listingId))].map(async (lid) => [lid, await getTrialTerms(lid)] as const)));
  const sent = await db
    .select({ id: trialProposals.id, listingId: listings.id, title: listings.title, hours: trialProposals.hours, offerFee: trialProposals.offerFee, status: trialProposals.status, sellerReply: trialProposals.sellerReply, createdAt: trialProposals.createdAt })
    .from(trialProposals).innerJoin(listings, eq(trialProposals.listingId, listings.id))
    .where(eq(trialProposals.buyerId, userId)).orderBy(pendingFirst, desc(trialProposals.createdAt)).limit(30);
  const pendingReceived = received.filter((r) => r.status === "PENDING").length;
  // 받은 제안의 구매자가 이미 말을 건 채팅방(판매자는 먼저 채팅을 열 수 없다)
  const myThreads = await db.select({ id: chatThreads.id, listingId: chatThreads.listingId, buyerId: chatThreads.buyerId }).from(chatThreads).where(eq(chatThreads.sellerId, userId));
  const threadOf = new Map(myThreads.map((t) => [`${t.listingId}|${t.buyerId}`, t.id]));
  const unreadChats = unreadThreads(userId);
  const nickname = me?.nickname ?? "테스터";
  const mine = await db
    .select({
      id: listings.id, title: listings.title, price: listings.price, status: listings.status, conditionGrade: listings.conditionGrade, modelName: productModels.modelName,
      categoryName: categories.name,
      photo: sql<string | null>`(select p.file_name from listing_photos p where p.listing_id = "listings"."id" order by p.sort_order, p.created_at limit 1)`,
    })
    .from(listings)
    .leftJoin(productModels, eq(listings.modelId, productModels.id))
    .leftJoin(categories, eq(productModels.categoryId, categories.id))
    .where(and(eq(listings.sellerId, userId), ne(listings.status, "REMOVED")))
    .orderBy(desc(listings.createdAt));
  const tabRows = mine.filter((m) => m.status === tab.status);
  const [{ wishCount }] = await db.select({ wishCount: sql<number>`count(*)` }).from(wishlists).where(eq(wishlists.userId, userId));
  const [{ demandCount }] = await db
    .select({ demandCount: sql<number>`count(*)` })
    .from(demandIntents)
    .where(and(eq(demandIntents.userId, userId), eq(demandIntents.active, true)));

  return (
    <div className="page my-page">
      <div className="my-head">
        <span className="seller-avatar" aria-hidden="true">{Array.from(nickname)[0]}</span>
        <h1 className="page-title">{nickname}님의 써보니</h1>
      </div>
      <div className="my-stats">
        <Link className="my-stat my-stat--navy" href="#my-listings"><small>내 판매 상품</small><strong>{mine.length}</strong></Link>
        <Link className="my-stat my-stat--coral" href="/wishlist"><small>찜</small><strong>{wishCount}</strong></Link>
        <Link className="my-stat my-stat--yellow" href="/demand"><small>찾는 상품</small><strong>{demandCount}</strong></Link>
      </div>
      <Link className="chat-banner" href="/chats"><strong>채팅</strong><small>{unreadChats > 0 ? `안 읽은 채팅 ${unreadChats}개` : "구매자·판매자와 나눈 대화"}</small></Link>
      <section className="proposals" id="proposals" aria-labelledby="received-title">
        <h2 className="section-title" id="received-title">받은 써보기 제안{pendingReceived > 0 ? ` · 새 제안 ${pendingReceived}` : ""}</h2>
        {received.length === 0 ? <p className="field-hint">아직 받은 제안이 없어요.</p> : (
          <ul className="proposal-list">
            {received.map((r) => {
              const t = sellerTerms.get(r.listingId);
              const mineFee = t?.tiers.find((x) => x.hours === r.hours)?.fee ?? null;
              return (
                <li key={r.id} className="proposal-card">
                  <small><Link href={`/listings/${r.listingId}`}>{r.title}</Link> · {r.buyer ?? "구매자"} · {relativeTime(r.createdAt)}</small>
                  <strong>{r.hours}시간 · 체험비 {formatWon(r.offerFee)} 제안</strong>
                  <small>{mineFee !== null ? `내 조건 ${formatWon(mineFee)} 대비 ${r.offerFee >= mineFee ? "같거나 많아요" : `${formatWon(mineFee - r.offerFee)} 적어요`}` : `상품 가격의 ${((r.offerFee / r.price) * 100).toFixed(1)}%`}</small>
                  {r.message && <p className="proposal-card__msg">“{r.message}”</p>}
                  <b className="proposal-card__status" data-status={r.status}>{PROPOSAL_LABEL[r.status] ?? r.status}</b>
                  {r.sellerReply && <small>내 답: {r.sellerReply}</small>}
                  {r.status === "PENDING" && <ProposalActions id={r.id} role="seller" />}
                  {threadOf.get(`${r.listingId}|${r.buyerId}`) && <Link className="proposal-card__chat" href={`/chats/${threadOf.get(`${r.listingId}|${r.buyerId}`)}`}>구매자와 채팅</Link>}
                </li>
              );
            })}
          </ul>
        )}
        <h2 className="section-title">보낸 써보기 제안</h2>
        {sent.length === 0 ? <p className="field-hint">상품 상세의 &apos;써보고 싶어요&apos;에서 판매자에게 제안할 수 있어요.</p> : (
          <ul className="proposal-list">
            {sent.map((r) => (
              <li key={r.id} className="proposal-card">
                <small><Link href={`/listings/${r.listingId}`}>{r.title}</Link> · {relativeTime(r.createdAt)}</small>
                <strong>{r.hours}시간 · 체험비 {formatWon(r.offerFee)}</strong>
                <b className="proposal-card__status" data-status={r.status}>{PROPOSAL_LABEL[r.status] ?? r.status}</b>
                {r.status === "ACCEPTED" && <small>판매자가 승인했어요. 써보기 결제·배송이 열리면 이 조건으로 진행돼요.</small>}
                {r.sellerReply && <small>판매자: {r.sellerReply}</small>}
                {r.status === "PENDING" && <ProposalActions id={r.id} role="buyer" />}
                <ChatStartButton listingId={r.listingId} label="판매자와 채팅" className="proposal-card__chat" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="section-title" id="my-listings">내 판매 상품</h2>
      <nav className="chat-tabs" aria-label="내 판매 상품 구분">
        {LISTING_TABS.map((t) => (
          <Link key={t.key} href={t.key === "active" ? "/me#my-listings" : `/me?tab=${t.key}#my-listings`} scroll={false} aria-current={tab.key === t.key ? "page" : undefined}>
            {t.label} {mine.filter((m) => m.status === t.status).length}
          </Link>
        ))}
      </nav>
      {tabRows.length === 0 ? (
        <div className="empty-card">
          <strong>{mine.length === 0 ? "아직 올린 상품이 없어요." : tab.empty}</strong>
          <Link href="/listings/new">내 물건 팔기</Link>
        </div>
      ) : (
        <div className="my-listings">
          {tabRows.slice(0, shown).map((m) => (
            <div key={m.id} className="my-listing">
              <Link href={`/listings/${m.id}`} className="my-listing__link">
                <ListThumb photo={m.photo} seed={m.id} kind={illustrationKind(m.categoryName, m.modelName)} alt={m.title} />
                <span className="my-listing__body">
                <small>{m.modelName} · {conditionLabel(m.conditionGrade)} · <b data-status={m.status}>{STATUS_LABEL[m.status] ?? m.status}</b></small>
                <strong>{m.title}</strong>
                <span>{formatWon(m.price)}</span>
                </span>
              </Link>
              <ListingStatusActions id={m.id} status={m.status} />
            </div>
          ))}
        </div>
      )}
      {tabRows.length > shown && (
        <Link className="more-link" href={`/me?${tab.key === "active" ? "" : `tab=${tab.key}&`}n=${shown / MY_PAGE_SIZE + 1}#my-listings`} scroll={false}>더 보기 ({tabRows.length - shown}개 더)</Link>
      )}
      <Link className="feedback-banner" href="/feedback"><strong>써보니에 의견 보내기</strong><small>망설인 이유, 바라는 점을 알려 주세요</small></Link>
      <p className="page-lead">로그아웃하면 이 기기에서 지금 계정으로 다시 들어올 수 없어요. 새로 시작하면 새 계정이 만들어져요.</p>
      <LogoutButton />
    </div>
  );
}
