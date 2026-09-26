import { db } from "@/db/client";
import { listings, productModels } from "@/db/schema";
import { eq, and, like, desc } from "drizzle-orm";
import Link from "next/link";

// 홈 — 리스트·검색 (P0 필수). 서버 컴포넌트에서 직접 조회.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const conditions = [eq(listings.status, "ACTIVE")];
  if (q) conditions.push(like(listings.title, `%${q}%`));

  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      conditionGrade: listings.conditionGrade,
      modelName: productModels.modelName,
      brand: productModels.brand,
    })
    .from(listings)
    .leftJoin(productModels, eq(listings.modelId, productModels.id))
    .where(and(...conditions))
    .orderBy(desc(listings.createdAt));

  return (
    <div>
      <form action="/" method="get" style={{ marginBottom: 20 }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="상품명 검색"
          style={{ padding: 8, width: "70%", marginRight: 8 }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>검색</button>
      </form>

      {rows.length === 0 && <p style={{ color: "#888" }}>등록된 상품이 없습니다.</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/listings/${r.id}`}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, textDecoration: "none", color: "#111" }}
          >
            <div style={{ fontSize: 12, color: "#888" }}>{r.brand} · {r.modelName}</div>
            <div style={{ fontWeight: 600 }}>{r.title}</div>
            <div>{r.price.toLocaleString()}원 · 상태 {r.conditionGrade}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
