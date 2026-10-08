import Link from "next/link";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, demandIntents, listings, productModels, users, wishlists } from "@/db/schema";
import { ListThumb } from "@/components/ListThumb";
import { getCurrentUserId } from "@/lib/session";
import { conditionLabel, formatWon, illustrationKind } from "@/ui/presentation";
import { ListingStatusActions, LogoutButton } from "./MyActions";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "판매 중", HIDDEN: "숨김", SOLD: "판매완료" };

export default async function MyPage() {
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
      <h2 className="section-title" id="my-listings">내 판매 상품</h2>
      {mine.length === 0 ? (
        <div className="empty-card">
          <strong>아직 올린 상품이 없어요.</strong>
          <Link href="/listings/new">내 물건 팔기</Link>
        </div>
      ) : (
        <div className="my-listings">
          {mine.map((m) => (
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
      <Link className="feedback-banner" href="/feedback"><strong>써보니에 의견 보내기</strong><small>망설인 이유, 바라는 점을 알려 주세요</small></Link>
      <p className="page-lead">로그아웃하면 이 기기에서 지금 계정으로 다시 들어올 수 없어요. 새로 시작하면 새 계정이 만들어져요.</p>
      <LogoutButton />
    </div>
  );
}
