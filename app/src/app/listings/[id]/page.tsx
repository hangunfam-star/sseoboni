import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { recordListingView } from "@/lib/events";
import { db } from "@/db/client";
import { categories, listingComponents, listings, marketValidationEvents, productModels, users, wishlists } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { modelDemand } from "@/lib/queries";
import { IntentActionBar } from "@/components/IntentActionBar";
import { ProductIllustration } from "@/components/ProductIllustration";
import { PhotoGallery } from "@/components/PhotoGallery";
import { TryFlow } from "@/components/TryFlow";
import { TrialCostSheet } from "@/components/TrialCostSheet";
import { loadTrialPricing } from "@/lib/trial-pricing-store";
import { photosFor } from "@/lib/photos";
import { conditionLabel, demandLabel, formatWon, illustrationKind, relativeTime, tryWantLabel } from "@/ui/presentation";

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
  if (!listing) notFound();

  const userId = await getCurrentUserId();
  const isOwner = userId === listing.sellerId;

  if (listing.status !== "ACTIVE" && !isOwner) {
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
  const pricing = await loadTrialPricing();
  const sellerTryText = {
    SELLER_TRY_YES: "판매자가 써보기를 허용했어요",
    SELLER_TRY_CONDITIONAL: "판매자가 조건부로 써보기를 허용했어요",
    SELLER_TRY_NO: "판매자가 바로 판매만 원해요",
  }[sellerTry[0]?.eventType ?? ""] ?? "판매자 써보기 의향 확인 전이에요";
  const seller = await db.query.users.findFirst({ where: eq(users.id, listing.sellerId) });
  const sellerName = seller?.nickname ?? "판매자";

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
        {listing.status !== "ACTIVE" && <span className="status-flag">내 상품 · {listing.status === "SOLD" ? "판매완료" : "숨김"}</span>}
      </div>
      <div className="listing-sheet">
        <p className="listing-meta">{[category?.name, model?.brand].filter(Boolean).join(" · ")}</p>
        <h1>{listing.title}</h1>
        <p className="listing-sub">{[model?.modelName, relativeTime(listing.createdAt)].filter(Boolean).join(" · ")}</p>
        <div className="attr-strip">
          <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z" /></svg></span><strong>{conditionLabel(listing.conditionGrade)}</strong><small>상태</small></div>
          <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></svg></span><strong>{components.length > 0 ? `${components.length}개` : "미입력"}</strong><small>구성품</small></div>
          <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg></span><strong>{spec ?? "확인 필요"}</strong><small>칩셋</small></div>
          <div><span className="attr-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z" /></svg></span><strong>{wishCount}</strong><small>찜</small></div>
        </div>
        <section className="try-panel" aria-labelledby="try-panel-title">
          <span className="try-hero__tag">사기 전에 써보기 · 준비 중</span>
          <h2 id="try-panel-title">이 상품, 써보고 살 수 있게<br />준비하고 있어요</h2>
          <TryFlow label="써보기 흐름" />
          <ul className="try-panel__facts">
            <li>{sellerTryText}</li>
            <li>{tryWantLabel(tryWanters) ?? "아직 써보고 싶다는 사람이 없어요. 첫 의견을 남겨 주세요"}</li>
          </ul>
          <p>아래 ‘써보고 싶어요’를 누르면 의견만 기록돼요. 결제와 배송은 일어나지 않아요.</p>
          {!isOwner && listing.status === "ACTIVE" && sellerTry[0]?.eventType !== "SELLER_TRY_NO" && (
            <TrialCostSheet listingId={id} price={listing.price} pricing={pricing} conditional={sellerTry[0]?.eventType === "SELLER_TRY_CONDITIONAL"} />
          )}
        </section>
        {components.length > 0 && (
          <section className="listing-section">
            <h2>구성품</h2>
            <ul className="component-list">{components.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
          </section>
        )}
        <section className="listing-section">
          <h2>상품 설명</h2>
          <p className="listing-description">{listing.description}</p>
        </section>
        <div className="seller-row">
          <span className="seller-avatar" aria-hidden="true">{Array.from(sellerName)[0]}</span>
          <div><strong>{sellerName}</strong><small>판매 중인 상품 {sellerCount}개</small></div>
        </div>
        {seekers && <p className="listing-stats">{seekers}</p>}
      </div>
      {!isOwner && listing.status === "ACTIVE" && (
        <IntentActionBar listingId={id} wished={wished} priceLabel={formatWon(listing.price)} initial={intents} />
      )}
      {isOwner && (
        <div className="owner-bar"><strong>{formatWon(listing.price)}</strong><Link className="secondary-button" href={`/listings/${id}/edit`}>수정</Link><Link className="secondary-button" href="/me">내 상품 관리</Link></div>
      )}
    </div>
  );
}
