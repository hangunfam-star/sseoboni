import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ProductCard } from "@/components/ProductCard";
import { db } from "@/db/client";
import { wishlists } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { listCards } from "@/lib/queries";

export default async function WishlistPage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return (
      <div className="page wishlist-page">
        <h1 className="page-title">찜</h1>
        <div className="empty-card">
          <strong>닉네임만 정하면 찜한 상품을 모아볼 수 있어요.</strong>
          <Link href="/login">닉네임 정하고 시작하기</Link>
        </div>
      </div>
    );
  }

  // 찜한 순서를 유지하고, 판매 중(ACTIVE)인 상품만 보여 준다(listCards가 ACTIVE만 반환).
  const mine = await db.select({ listingId: wishlists.listingId }).from(wishlists).where(eq(wishlists.userId, userId)).orderBy(desc(wishlists.createdAt));
  const ids = mine.map((w) => w.listingId);
  const byId = new Map((await listCards({ ids })).map((r) => [r.id, r]));
  const rows = ids.map((id) => byId.get(id)).filter((r) => r !== undefined);

  return (
    <div className="page wishlist-page">
      <h1 className="page-title">찜</h1>
      {rows.length === 0 ? (
        <div className="empty-card">
          <strong>아직 찜한 상품이 없어요.</strong>
          <Link href="/">상품 둘러보기</Link>
        </div>
      ) : (
        <div className="product-grid">{rows.map((row) => <ProductCard key={row.id} {...row} />)}</div>
      )}
    </div>
  );
}
