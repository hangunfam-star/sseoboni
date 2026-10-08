// 판매 등록·찾는 상품에서 함께 쓰는 "직접 입력 모델" 처리
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, productModels } from "@/db/schema";
import { isSellCategory } from "@/ui/categories";
import { COMPONENT_MAX } from "@/ui/listing-components";

export type CustomModelInput = { brand: string; modelName: string; category: string };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// param: v 요청 본문의 customModel 값(unknown)
// return: 앞뒤 공백을 지운 입력값, 객체가 아니면 null
export function parseCustomModel(v: unknown): CustomModelInput | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return { brand: str(o.brand), modelName: str(o.modelName), category: str(o.category) };
}

// param: c 직접 입력 모델
// return: 잘못된 곳의 안내 문구, 문제없으면 null
export function validateCustomModel(c: CustomModelInput): string | null {
  if (c.brand.length < 1 || c.brand.length > 30) return "브랜드는 1~30자로 입력하세요.";
  if (c.modelName.length < 2 || c.modelName.length > 60) return "모델명은 2~60자로 입력하세요.";
  if (!isSellCategory(c.category)) return "상품 종류를 골라 주세요.";
  return null;
}

// param: tx 트랜잭션, c 검증된 직접 입력 모델, userId 입력한 사람
// return: { modelId, created } — 같은 브랜드·모델명(대소문자·앞뒤 공백 무시)이 있으면 그 모델을 쓴다(수요가 한 모델로 모인다).
export function resolveCustomModel(tx: Tx, c: CustomModelInput, userId: string): { modelId: string; created: boolean } {
  const existing = tx.select({ id: productModels.id }).from(productModels)
    .where(and(eq(productModels.active, true),
      sql`lower(trim(${productModels.brand})) = lower(${c.brand})`,
      sql`lower(trim(${productModels.modelName})) = lower(${c.modelName})`))
    .get();
  if (existing) return { modelId: existing.id, created: false };
  const category = tx.select({ id: categories.id }).from(categories).where(eq(categories.name, c.category)).get()
    ?? tx.insert(categories).values({ name: c.category, trialEnabled: false }).returning({ id: categories.id }).get();
  const modelId = tx.insert(productModels).values({
    brand: c.brand,
    modelName: c.modelName,
    categoryId: category.id,
    canonicalSpec: JSON.stringify({ source: "USER_INPUT", createdBy: userId }),
  }).returning({ id: productModels.id }).get().id;
  return { modelId, created: true };
}


// param: v 요청 본문의 components 값(unknown)
// return: 정리된 구성품 이름 목록(중복 제거), 형식이 틀리면 오류 문구
export function parseComponents(v: unknown): string[] | string {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return "구성품 형식이 올바르지 않습니다.";
  const names = [...new Set(v.map(str).filter(Boolean))];
  if (names.length > COMPONENT_MAX) return `구성품은 ${COMPONENT_MAX}개까지 적을 수 있어요.`;
  if (names.some((n) => n.length > 30)) return "구성품 이름은 30자 이하로 입력하세요.";
  return names;
}
