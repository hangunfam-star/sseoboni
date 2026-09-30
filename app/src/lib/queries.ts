// 화면에서 함께 쓰는 조회. 모든 숫자는 중복 제거한 실제 값만 반환한다.
import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, listings, productModels } from "@/db/schema";

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
};

// param: opts.q 제목·모델 검색어, opts.categoryId 카테고리, opts.ids 특정 상품만. return: ACTIVE 상품 카드 목록(최신순)
export async function listCards(opts: { q?: string; categoryId?: string; ids?: string[] } = {}): Promise<CardRow[]> {
  const where: SQL[] = [eq(listings.status, "ACTIVE")];
  if (opts.q) {
    const k = `%${opts.q}%`;
    where.push(or(like(listings.title, k), like(productModels.modelName, k), like(productModels.brand, k))!);
  }
  if (opts.categoryId) where.push(eq(productModels.categoryId, opts.categoryId));
  if (opts.ids) {
    if (opts.ids.length === 0) return [];
    where.push(inArray(listings.id, opts.ids));
  }
  return db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      conditionGrade: listings.conditionGrade,
      createdAt: listings.createdAt,
      brand: productModels.brand,
      modelName: productModels.modelName,
      categoryName: categories.name,
      wishCount: sql<number>`(select count(distinct w.user_id) from wishlists w where w.listing_id = "listings"."id")`,
    })
    .from(listings)
    .leftJoin(productModels, eq(listings.modelId, productModels.id))
    .leftJoin(categories, eq(productModels.categoryId, categories.id))
    .where(and(...where))
    .orderBy(desc(listings.createdAt));
}

export type ModelDemand = { modelId: string; brand: string; modelName: string; seekers: number; triers: number; onSale: number };

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
    })
    .from(productModels)
    .where(modelIds ? inArray(productModels.id, modelIds) : eq(productModels.active, true));
  return rows.sort((a, b) => b.seekers - a.seekers);
}
