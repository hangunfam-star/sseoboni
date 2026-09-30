import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { recordListingView } from "@/lib/events";
import { db } from "@/db/client";
import { categories, listingComponents, listings, marketValidationEvents, productModels, wishlists } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { findActiveInviteByUserId } from "@/lib/invites";
import { modelDemand } from "@/lib/queries";
import { IntentActionBar } from "@/components/IntentActionBar";
import { ProductIllustration } from "@/components/ProductIllustration";
import { conditionLabel, demandLabel, formatWon, illustrationKind, relativeTime } from "@/ui/presentation";

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
  const [{ sellerCount }] = await db
    .select({ sellerCount: sql<number>`count(*)` })
    .from(listings)
    .where(and(eq(listings.sellerId, listing.sellerId), eq(listings.status, "ACTIVE")));
  const [{ wishCount }] = await db
    .select({ wishCount: sql<number>`count(distinct ${wishlists.userId})` })
    .from(wishlists)
    .where(eq(wishlists.listingId, id));
  const sellerName = findActiveInviteByUserId(listing.sellerId)?.nickname ?? "판매자";

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
  const stats = [seekers, wishCount > 0 ? `찜 ${wishCount}` : null].filter(Boolean).join(" · ");

  return (
    <div className="listing-detail">
      <div className="listing-hero">
        <ProductIllustration seed={id} kind={illustrationKind(category?.name ?? null, model?.modelName ?? null)} size={200} className="listing-hero__art" />
        <BackButton />
        {listing.status !== "ACTIVE" && <span className="status-flag">내 상품 · {listing.status === "SOLD" ? "판매완료" : "숨김"}</span>}
      </div>
      <div className="listing-sheet">
        <div className="seller-row">
          <span className="seller-avatar" aria-hidden="true">{Array.from(sellerName)[0]}</span>
          <div><strong>{sellerName}</strong><small>판매 중인 상품 {sellerCount}개</small></div>
        </div>
        <h1>{listing.title}</h1>
        <p className="listing-meta">{[category?.name, [model?.brand, model?.modelName].filter(Boolean).join(" "), relativeTime(listing.createdAt)].filter(Boolean).join(" · ")}</p>
        <div className="spec-tiles">
          <div><small>상태</small><strong>{conditionLabel(listing.conditionGrade)}</strong></div>
          <div><small>구성품</small><strong>{components.length > 0 ? `${components.length}개` : "미입력"}</strong></div>
          <div><small>칩셋</small><strong>{spec ?? "확인 필요"}</strong></div>
        </div>
        <p className="listing-description">{listing.description}</p>
        <div className="try-strip">
          <span className="try-strip__icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
          <div><strong>사기 전에 써보기 · 준비 중</strong><small>테스트 기간이라 의향만 받아요</small></div>
        </div>
        {stats && <p className="listing-stats">{stats}</p>}
      </div>
      {!isOwner && listing.status === "ACTIVE" && (
        <IntentActionBar listingId={id} wished={wished} priceLabel={formatWon(listing.price)} initial={intents} />
      )}
      {isOwner && (
        <div className="owner-bar"><strong>{formatWon(listing.price)}</strong><Link className="secondary-button" href="/me">내 상품 관리</Link></div>
      )}
    </div>
  );
}
