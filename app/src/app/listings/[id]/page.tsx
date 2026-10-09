import Link from "next/link";
import { Icon } from "@/components/Icon";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { recordListingView } from "@/lib/events";
import { db } from "@/db/client";
import { categories, listingComponents, listings, marketValidationEvents, productModels, trialProposals, users, wishlists } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { modelDemand } from "@/lib/queries";
import { IntentActionBar } from "@/components/IntentActionBar";
import { ProductIllustration } from "@/components/ProductIllustration";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ShareButton } from "@/components/ShareButton";
import WishlistButton from "./WishlistButton";
import { loadTradeSettings } from "@/lib/trade-settings-store";
import { activeOrderOf } from "@/lib/orders";
import { gradesOf, modelPrice, trialFeeRatio } from "@/lib/trade-stats";
import { starSummary, trialReviewsByModel } from "@/lib/reviews";
import { questionsFor } from "@/ui/trade-rules";
import { sellerAccounts } from "@/db/schema";
import { readSellerAccount } from "@/lib/seller-account";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { TryFlow } from "@/components/TryFlow";
import { ChatStartButton } from "@/components/ChatStartButton";
import { TrialCostSheet } from "@/components/TrialCostSheet";
import { expireOldProposals, getTrialTerms } from "@/lib/trial-terms";
import { photosFor } from "@/lib/photos";
import { conditionLabel, demandLabel, formatWon, illustrationKind, relativeTime, tryWantLabel } from "@/ui/presentation";
import { feePctNow } from "@/lib/platform-fee-store";

// return: 공유 링크 미리보기(카카오톡 등). 판매 중 상품만 제목·가격·사진을 싣는다. 주소는 지금 접속한 주소(ngrok 등) 기준.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing || listing.status !== "ACTIVE") return { title: "써보니 — 체험형 중고거래" };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  // 판매자의 가장 최근 써보기 답(홈의 써보니 상품 구분과 같은 기준)
  const latestTry = db.get<{ t: string }>(sql`select event_type as t from market_validation_events where listing_id = ${id} and event_type like 'SELLER_TRY_%' order by created_at desc, rowid desc limit 1`)?.t;
  const title = `${listing.title} · ${formatWon(listing.price)}`;
  const description = latestTry === "SELLER_TRY_YES" ? "써보기 가능한 상품이에요. 사기 전에 먼저 써보고 결정하세요 — 써보니" : "중고, 이제 써보고 사세요 — 써보니";
  const image = { url: `/api/listings/${id}/og`, width: 1200, height: 630, alt: listing.title };
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: `${title} | 써보니`,
    description,
    openGraph: { type: "website", siteName: "써보니", title, description, url: `/listings/${id}`, images: [image], locale: "ko_KR" },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

function BackButton() {
  return (
    <Link className="icon-button icon-button--float" href="/" aria-label="뒤로">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
    </Link>
  );
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing || listing.status === "REMOVED") notFound();

  const userId = await getCurrentUserId();
  const isOwner = userId === listing.sellerId;

  if (!["ACTIVE", "RESERVED"].includes(listing.status) && !isOwner) {
    return (
      <div className="page ended-page">
        <BackButton />
        <div className="empty-card">
          <strong>판매가 종료된 상품입니다.</strong>
          <Link href="/">다른 상품 둘러보기</Link>
        </div>
      </div>
    );
  }

  const model = await db.query.productModels.findFirst({ where: eq(productModels.id, listing.modelId) });
  const category = model ? await db.query.categories.findFirst({ where: eq(categories.id, model.categoryId) }) : undefined;
  const [demand] = await modelDemand([listing.modelId]);
  const components = await db.select().from(listingComponents).where(eq(listingComponents.listingId, id));
  const photos = (await photosFor([id])).get(id) ?? [];
  const [{ sellerCount }] = await db
    .select({ sellerCount: sql<number>`count(*)` })
    .from(listings)
    .where(and(eq(listings.sellerId, listing.sellerId), eq(listings.status, "ACTIVE")));
  const [{ wishCount }] = await db
    .select({ wishCount: sql<number>`count(distinct ${wishlists.userId})` })
    .from(wishlists)
    .where(eq(wishlists.listingId, id));
  // 써보기 신호: 판매자의 마지막 써보기 의향 답변, '써보고 싶어요'를 누른 사람 수(중복 제거)
  const sellerTry = await db
    .select({ eventType: marketValidationEvents.eventType })
    .from(marketValidationEvents)
    .where(and(eq(marketValidationEvents.listingId, id), inArray(marketValidationEvents.eventType, ["SELLER_TRY_YES", "SELLER_TRY_CONDITIONAL", "SELLER_TRY_NO"])))
    .orderBy(desc(marketValidationEvents.createdAt), sql`rowid desc`)
    .limit(1);
  const [{ tryWanters }] = await db
    .select({ tryWanters: sql<number>`count(distinct ${marketValidationEvents.userId})` })
    .from(marketValidationEvents)
    .where(and(eq(marketValidationEvents.listingId, id), eq(marketValidationEvents.eventType, "CLICK_TRY_WANT")));
  const terms = await getTrialTerms(id);
  const feePct = await feePctNow();
  const sellerNo = sellerTry[0]?.eventType === "SELLER_TRY_NO";
  const termsSummary = terms
    ? terms.tiers.map((t) => `${t.hours}시간 ${formatWon(t.fee)}`).join(" · ")
    : null;
  const sellerTryText = sellerNo
    ? "판매자는 바로 판매를 원해요 · 써보기 제안은 받아요"
    : terms ? `판매자가 써보기를 허용했어요 · ${termsSummary}`
    : sellerTry[0] ? "판매자가 써보기를 허용했어요 · 조건은 제안으로 정해요" : "판매자 써보기 의향 확인 전이에요 · 제안은 받아요";
  expireOldProposals([id]);
  const mine = userId && !isOwner
    ? (await db.select({ id: trialProposals.id, hours: trialProposals.hours, offerFee: trialProposals.offerFee, status: trialProposals.status, sellerReply: trialProposals.sellerReply })
        .from(trialProposals).where(and(eq(trialProposals.listingId, id), eq(trialProposals.buyerId, userId)))
        .orderBy(desc(trialProposals.createdAt), sql`rowid desc`).limit(1))[0] ?? null
    : null;
  const [{ pendingCount }] = isOwner
    ? await db.select({ pendingCount: sql<number>`count(*)` }).from(trialProposals).where(and(eq(trialProposals.listingId, id), eq(trialProposals.status, "PENDING")))
    : [{ pendingCount: 0 }];
  const seller = await db.query.users.findFirst({ where: eq(users.id, listing.sellerId) });
  const sellerName = seller?.nickname ?? "판매자";
  // 거래: 운영자가 거래를 열었는지, 판매자 정산 계좌, 진행 중 거래(거래 중 표시·내 거래 바로가기)
  const trade = await loadTradeSettings();
  const account = await db.query.sellerAccounts.findFirst({ where: eq(sellerAccounts.userId, listing.sellerId) });
  const active = listing.status === "RESERVED" ? await activeOrderOf(id) : null;
  const myOrderId = active && (active.buyerId === userId || active.sellerId === userId) ? active.id : null;
  const shippingFee = terms?.shippingOneWay ?? account?.defaultShipping ?? 0;
  const grades = await gradesOf(listing.sellerId);
  const stars = await starSummary(listing.sellerId);
  const price = await modelPrice(listing.modelId);
  const feeRatio = await trialFeeRatio(category?.name ?? null);
  const modelReviews = await trialReviewsByModel(listing.modelId, 5);

  // 조회 이벤트: 판매자 본인 조회는 제외, 같은 사람의 30분 안 재조회는 1회로 센다.
  if (!isOwner) await recordListingView(id, listing.modelId, userId);

  let wished = false;
  const intents = { TRY: false, BUY: false };
  if (userId) {
    wished = Boolean(await db.query.wishlists.findFirst({ where: and(eq(wishlists.userId, userId), eq(wishlists.listingId, id)) }));
    const mine = await db
      .select({ eventType: marketValidationEvents.eventType })
      .from(marketValidationEvents)
      .where(and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.listingId, id), inArray(marketValidationEvents.eventType, ["CLICK_TRY_WANT", "CLICK_BUY_WANT"])));
    intents.TRY = mine.some((m) => m.eventType === "CLICK_TRY_WANT");
    intents.BUY = mine.some((m) => m.eventType === "CLICK_BUY_WANT");
  }

  const spec = (() => {
    try { return JSON.parse(model?.canonicalSpec ?? "{}").cpu as string | undefined; } catch { return undefined; }
  })();
  const seekers = demandLabel(demand?.seekers ?? 0);

  return (
    <div className="listing-detail">
      <div className="listing-hero">
        {photos.length > 0
          ? <PhotoGallery photos={photos} title={listing.title} />
          : <ProductIllustration seed={id} kind={illustrationKind(category?.name ?? null, model?.modelName ?? null)} size={200} className="listing-hero__art" />}
        <BackButton />
        {listing.status === "ACTIVE" && <ShareButton listingId={id} title={listing.title} text={`${listing.title} · ${formatWon(listing.price)}`} />}
        {listing.status !== "ACTIVE" && <span className="status-flag">{isOwner ? "내 상품 · " : ""}{listing.status === "SOLD" ? "판매완료" : listing.status === "RESERVED" ? "거래 중" : "숨김"}</span>}
      </div>
      <div className="listing-sheet">
        <p className="listing-meta">{[category?.name, model?.brand].filter(Boolean).join(" · ")}</p>
        <h1>{listing.title}</h1>
        <p className="listing-sub">{[model?.modelName, relativeTime(listing.createdAt)].filter(Boolean).join(" · ")}</p>
        <div className="attr-strip">
          <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z" /></svg></span><strong>{conditionLabel(listing.conditionGrade)}</strong><small>상태</small></div>
          <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></svg></span><strong>{components.length > 0 ? `${components.length}개` : "미입력"}</strong><small>구성품</small></div>
          <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg></span><strong>{spec ?? "확인 필요"}</strong><small>칩셋</small></div>
          {!isOwner && listing.status === "ACTIVE"
            ? <WishlistButton key={`tile-${wished}`} variant="tile" listingId={id} initialWished={wished} count={wishCount} />
            : <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z" /></svg></span><strong>{wishCount}</strong><small>{isOwner ? "찜 · 내 상품" : "찜"}</small></div>}
        </div>
        <section className="try-panel" aria-labelledby="try-panel-title">
          <span className="try-hero__tag">{trade.tradeOpen ? "사기 전에 써보기" : "사기 전에 써보기 · 준비 중"}</span>
          <h2 id="try-panel-title">{trade.tradeOpen ? <>받은 날부터 써보고<br />사거나 돌려보내세요</> : <>이 상품, 써보고 살 수 있게<br />준비하고 있어요</>}</h2>
          <TryFlow label="써보기 흐름" />
          <ul className="try-panel__facts">
            <li>{sellerTryText}</li>
            <li>{tryWantLabel(tryWanters) ?? "아직 써보고 싶다는 사람이 없어요. 첫 의견을 남겨 주세요"}</li>
          </ul>
          <p>{trade.tradeOpen
            ? "상품가와 발송비를 판매자 계좌로 보내고, 받은 때부터 써봐요. 사면 체험료 0원, 돌려보내면 상품가에서 체험료만 빼고 돌려받아요."
            : "아래 ‘써보고 싶어요’를 누르면 원하는 기간과 체험비를 판매자에게 제안할 수 있어요. 결제와 배송은 아직 일어나지 않아요."}</p>
          {!isOwner && listing.status === "ACTIVE" && !sellerNo && terms && (
            <TrialCostSheet listingId={id} price={listing.price} terms={terms} shippingFee={shippingFee} tradeOpen={trade.tradeOpen} graceHours={trade.decisionGraceHours} />
          )}
          {isOwner && pendingCount > 0 && <Link className="trial-cost__toggle owner-proposals" href="/me#proposals">받은 써보기 제안 {pendingCount}개 보기</Link>}
        </section>
        {components.length > 0 && (
          <section className="listing-section">
            <h2><Icon name="box" />구성품</h2>
            <ul className="component-list">{components.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
          </section>
        )}
        <section className="listing-section">
          <h2><Icon name="doc" />상품 설명</h2>
          <p className="listing-description">{listing.description}</p>
        </section>
        <section className="listing-section price-stats" aria-labelledby="price-stats-title">
          <h2 id="price-stats-title"><Icon name="chart" />써보니 실거래 시세</h2>
          {price.insufficient
            ? <p className="field-hint">비교 거래 부족 · 같은 모델의 최근 {price.days}일 구매 완료 {price.count}건(최소 {price.minCount}건부터 보여 드려요)</p>
            : <p><strong>중앙값 {formatWon(price.median!)}</strong> <small>범위 {formatWon(price.min!)}~{formatWon(price.max!)} · {price.count}건 · 최근 {price.days}일 · {price.asOf} 기준</small></p>}
          {feeRatio && !feeRatio.insufficient && feeRatio.pct !== null && <p className="field-hint">{feeRatio.category} 써보기 조건 참고: 하루 체험료가 상품가의 약 {feeRatio.pct}% (등록된 조건 {feeRatio.listings}개 기준)</p>}
        </section>
        {modelReviews.length > 0 && (
          <section className="listing-section model-reviews" aria-labelledby="model-reviews-title">
            <h2 id="model-reviews-title"><Icon name="quote" />이 모델 써본 사람들의 한마디</h2>
            <ul>
              {modelReviews.map((r) => (
                <li key={r.id}>
                  <small className="trial-cert">체험 거래 인증 · 체험 기간 {Math.round(r.hours / 24) >= 1 ? `${Math.round(r.hours / 24)}일` : `${r.hours}시간`} · {r.outcome === "PURCHASED" ? "써보고 샀어요" : "써보고 돌려보냈어요"} · 상태 {conditionLabel(r.conditionGrade ?? "")}</small>
                  {r.learned && <p>“{r.learned}”</p>}
                  {r.answers.map((a) => <p key={a.q}><b>{a.q}</b> {a.a}</p>)}
                  <small>{r.writer} · {relativeTime(r.createdAt)}</small>
                </li>
              ))}
            </ul>
            <p className="field-hint">개별 중고 상품의 상태라 모델 전체 성능과 다를 수 있어요.</p>
          </section>
        )}
        <div className="seller-row">
          <span className="seller-avatar" aria-hidden="true">{Array.from(sellerName)[0]}</span>
          <Link className="seller-row__name" href={`/sellers/${listing.sellerId}`}><strong>{sellerName}</strong><small>판매 {grades.seller.name}{stars.asSeller ? ` · ★${stars.asSeller.avg} (${stars.asSeller.count})` : ""} · 판매 중 {sellerCount}개</small></Link>
          {!isOwner && listing.status === "ACTIVE" && <ChatStartButton listingId={id} label="채팅" className="seller-row__chat" />}
        </div>
        {seekers && <p className="listing-stats">{seekers}</p>}
      </div>
      {!isOwner && listing.status === "ACTIVE" && (
        <IntentActionBar listingId={id} wished={wished} priceLabel={formatWon(listing.price)} initial={intents} price={listing.price} terms={terms} sellerNo={sellerNo} mine={mine} feePct={feePct}
          trade={{ open: trade.tradeOpen, accountReady: readSellerAccount(account) !== null, shippingFee, questionOptions: questionsFor(category?.name ?? null), graceHours: trade.decisionGraceHours, paymentWaitHours: trade.paymentWaitHours }} />
      )}
      {!isOwner && listing.status === "RESERVED" && (
        <div className="owner-bar"><strong>{formatWon(listing.price)}</strong>{myOrderId ? <Link className="dark-button" href={`/orders/${myOrderId}`}>내 거래 보기</Link> : <span className="field-hint">다른 분과 거래 중이에요</span>}</div>
      )}
      {isOwner && (
        <div className="owner-bar"><strong>{formatWon(listing.price)}</strong>{myOrderId && <Link className="dark-button" href={`/orders/${myOrderId}`}>거래 보기</Link>}<Link className="secondary-button" href={`/listings/${id}/edit`}>수정</Link><Link className="secondary-button" href="/me">내 상품 관리</Link></div>
      )}
    </div>
  );
}
