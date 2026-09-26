import { db } from "@/db/client";
import { listings, productModels, marketValidationEvents, wishlists } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";
import { notFound } from "next/navigation";
import WishlistButton from "./WishlistButton";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing) notFound();

  const model = await db.query.productModels.findFirst({ where: eq(productModels.id, listing.modelId) });
  const userId = await getCurrentUserId();

  await db.insert(marketValidationEvents).values({
    eventType: "VIEW_LISTING",
    listingId: id,
    modelId: listing.modelId,
    userId: userId ?? null,
  });

  let wished = false;
  if (userId) {
    const w = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, id)));
    wished = w.length > 0;
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: "#888" }}>{model?.brand} · {model?.modelName}</div>
      <h1 style={{ marginBottom: 4 }}>{listing.title}</h1>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{listing.price.toLocaleString()}원</div>
      <div style={{ margin: "8px 0", color: "#555" }}>상태 등급: {listing.conditionGrade}</div>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{listing.description}</p>

      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <WishlistButton listingId={id} initialWished={wished} />
        <button disabled title="Gate 2 승인 전까지 비활성화" style={{ padding: "8px 14px", color: "#aaa" }}>
          써보기 신청 (준비 중)
        </button>
      </div>
    </div>
  );
}
