// 화면에서 함께 쓰는 조회. 모든 숫자는 중복 제거한 실제 값만 반환한다.
import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, listings, productModels } from "@/db/schema";

const WISH_COUNT = sql<number>`(select count(distinct w.user_id) from wishlists w where w.listing_id = "listings"."id")`;

export const PAGE_SIZE = 20;

export type CardRow = {
  id: string;
  title: string;
  price: number;
  conditionGrade: string;
  createdAt: string;
  brand: string | null;
  modelName: string | null;
  categoryName: string | null;
  wishCount: number;
  photo: string | null; // 첫 번째 사진 파일 이름(없으면 null)
  tryOk: number; // 판매자의 가장 최근 써보기 답: 2 = 허용(YES), 1 = 조건부(CONDITIONAL), 0 = 거절·미답
  tryWanters: number; // '써보고 싶어요'를 누른 사람 수(중복 제거)
};

// param: opts.q 제목·모델 검색어, opts.categoryId 카테고리, opts.brand 브랜드, opts.ids 특정 상품만, opts.sort 최신(new)·찜 많은 순(popular), opts.limit 최대 개수
// return: ACTIVE 상품 카드 목록
export async function listCards(opts: { q?: string; categoryId?: string; brand?: string; ids?: string[]; sort?: "new" | "popular"; limit?: number } = {}): Promise<CardRow[]> {
  const where: SQL[] = [eq(listings.status, "ACTIVE")];
  if (opts.q) {
    const k = `%${opts.q}%`;
    where.push(or(like(listings.title, k), like(productModels.modelName, k), like(productModels.brand, k))!);
  }
  if (opts.categoryId) where.push(eq(productModels.categoryId, opts.categoryId));
  if (opts.brand) where.push(eq(productModels.brand, opts.brand));
  if (opts.ids) {
    if (opts.ids.length === 0) return [];
    where.push(inArray(listings.id, opts.ids));
  }
  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      conditionGrade: listings.conditionGrade,
      createdAt: listings.createdAt,
      brand: productModels.brand,
      modelName: productModels.modelName,
      categoryName: categories.name,
      wishCount: WISH_COUNT,
      photo: sql<string | null>`(select p.file_name from listing_photos p where p.listing_id = "listings"."id" order by p.sort_order, p.created_at limit 1)`,
      tryOk: sql<number>`coalesce((select case e.event_type when 'SELLER_TRY_YES' then 2 when 'SELLER_TRY_CONDITIONAL' then 1 else 0 end from market_validation_events e where e.listing_id = "listings"."id" and e.event_type like 'SELLER_TRY_%' order by e.created_at desc, e.rowid desc limit 1), 0)`,
      tryWanters: sql<number>`(select count(distinct e.user_id) from market_validation_events e where e.listing_id = "listings"."id" and e.event_type = 'CLICK_TRY_WANT')`,
    })
    .from(listings)
    .leftJoin(productModels, eq(listings.modelId, productModels.id))
    .leftJoin(categories, eq(productModels.categoryId, categories.id))
    .where(and(...where))
    .orderBy(...(opts.sort === "popular" ? [desc(WISH_COUNT), desc(listings.createdAt)] : [desc(listings.createdAt)]))
    .limit(opts.limit ?? -1);
  return rows;
}

export type ModelDemand = { modelId: string; brand: string; modelName: string; seekers: number; triers: number; onSale: number; categoryName: string | null; photo: string | null };

// return: 모델별 찾는 사람(중복 제거)·써보고 싶은 사람·판매 중 수. 찾는 사람 많은 순
export async function modelDemand(modelIds?: string[]): Promise<ModelDemand[]> {
  const rows = await db
    .select({
      modelId: productModels.id,
      brand: productModels.brand,
      modelName: productModels.modelName,
      // 단일 테이블 select에서는 Drizzle이 컬럼 앞 테이블명을 생략하므로, 상관 서브쿼리는 별칭을 명시한 SQL로 쓴다.
      seekers: sql<number>`(select count(distinct di.user_id) from demand_intents di where di.model_id = "product_models"."id" and di.active = 1)`,
      triers: sql<number>`(select count(distinct di.user_id) from demand_intents di where di.model_id = "product_models"."id" and di.active = 1 and di.intent_type in ('WANT_TO_TRY','PAID_TRY_INTENT'))`,
      onSale: sql<number>`(select count(*) from listings l where l.model_id = "product_models"."id" and l.status = 'ACTIVE')`,
      categoryName: sql<string | null>`(select c.name from categories c where c.id = "product_models"."category_id")`,
      photo: sql<string | null>`(select p.file_name from listing_photos p join listings l on l.id = p.listing_id where l.model_id = "product_models"."id" and l.status = 'ACTIVE' order by l.created_at desc, p.sort_order limit 1)`,
    })
    .from(productModels)
    .where(modelIds ? inArray(productModels.id, modelIds) : eq(productModels.active, true));
  return rows.sort((a, b) => b.seekers - a.seekers);
}
