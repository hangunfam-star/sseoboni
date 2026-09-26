// 써보니 — Gate 0 (P0) 스키마 (Drizzle ORM / SQLite)
// 근거: 써보니_Codex_개발_마스터기획_v1.1.md §60(핵심 DB 엔티티), §78(Gate 시스템), §101(MVP 완료 정의)
//
// 의도적으로 제외한 엔티티 (Gate 1/2 승인 전까지 만들지 않음):
//   TrialPolicy, Transaction, ConditionSnapshot, Dispute,
//   Payment, Refund, Settlement, SettlementHold, Chargeback
// 이유: §101 "Validation MVP는 실제 결제·정산·발송을 발생시키지 않는다"

import { sqliteTable, text, integer, real, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const cuid = () => crypto.randomUUID();

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(cuid),
  role: text("role").notNull(), // BUYER | SELLER | BOTH | ADMIN
  status: text("status").notNull().default("ACTIVE"),
  identityVerified: integer("identity_verified", { mode: "boolean" }).notNull().default(false),
  phoneVerified: integer("phone_verified", { mode: "boolean" }).notNull().default(false),
  buyerTrustLevel: integer("buyer_trust_level").notNull().default(0),
  sellerTrustLevel: integer("seller_trust_level").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const sellerProfiles = sqliteTable("seller_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id),
  sellerType: text("seller_type").notNull().default("INDIVIDUAL"), // INDIVIDUAL | BUSINESS
  businessVerified: integer("business_verified", { mode: "boolean" }).notNull().default(false),
  avgShipTime: integer("avg_ship_time"),
  descriptionMatchScore: real("description_match_score"),
  disputeRate: real("dispute_rate").notNull().default(0),
  trialCount: integer("trial_count").notNull().default(0),
  saleCount: integer("sale_count").notNull().default(0),
});

export const buyerProfiles = sqliteTable("buyer_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id),
  trialCount: integer("trial_count").notNull().default(0),
  purchaseCount: integer("purchase_count").notNull().default(0),
  normalReturnCount: integer("normal_return_count").notNull().default(0),
  onTimeReturnRate: real("on_time_return_rate"),
  damageIncidentCount: integer("damage_incident_count").notNull().default(0),
  chargebackIncidentCount: integer("chargeback_incident_count").notNull().default(0),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(cuid),
  name: text("name").notNull(),
  trialEnabled: integer("trial_enabled", { mode: "boolean" }).notNull().default(false),
  trialPolicyId: text("trial_policy_id"), // Gate2 이후 실제 FK로 연결 (지금은 참조 문자열만)
});

export const productModels = sqliteTable("product_models", {
  id: text("id").primaryKey().$defaultFn(cuid),
  brand: text("brand").notNull(),
  modelName: text("model_name").notNull(),
  categoryId: text("category_id").notNull().references(() => categories.id),
  canonicalSpec: text("canonical_spec"), // JSON 문자열
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const listings = sqliteTable("listings", {
  id: text("id").primaryKey().$defaultFn(cuid),
  sellerId: text("seller_id").notNull().references(() => users.id),
  modelId: text("model_id").notNull().references(() => productModels.id),
  title: text("title").notNull(),
  price: integer("price").notNull(),
  conditionGrade: text("condition_grade").notNull(), // S | A | B | C 등
  description: text("description").notNull(),
  directSaleEnabled: integer("direct_sale_enabled", { mode: "boolean" }).notNull().default(true),
  trialEnabled: integer("trial_enabled", { mode: "boolean" }).notNull().default(false), // Gate2 전까지 UI에서 항상 false
  trialPolicyId: text("trial_policy_id"),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE | SOLD | HIDDEN | REMOVED
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const listingComponents = sqliteTable("listing_components", {
  id: text("id").primaryKey().$defaultFn(cuid),
  listingId: text("listing_id").notNull().references(() => listings.id),
  name: text("name").notNull(),
  requiredOnReturn: integer("required_on_return", { mode: "boolean" }).notNull().default(false),
  replacementValue: integer("replacement_value"),
});

// 마스터기획 §60에는 없지만 P0 요구사항("리스트·검색·상세·찜")을 위해 추가한 최소 모델
export const wishlists = sqliteTable("wishlists", {
  id: text("id").primaryKey().$defaultFn(cuid),
  userId: text("user_id").notNull(),
  listingId: text("listing_id").notNull().references(() => listings.id),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  userListingUnique: uniqueIndex("wishlists_user_listing_idx").on(t.userId, t.listingId),
}));

export const demandIntents = sqliteTable("demand_intents", {
  id: text("id").primaryKey().$defaultFn(cuid),
  userId: text("user_id").notNull().references(() => users.id),
  modelId: text("model_id").notNull().references(() => productModels.id),
  intentType: text("intent_type").notNull(), // LOOKING_TO_BUY | WANT_TO_TRY | PAID_TRY_INTENT
  desiredPriceMin: integer("desired_price_min"),
  desiredPriceMax: integer("desired_price_max"),
  desiredTrialHours: integer("desired_trial_hours"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// P0 요구사항("시장검증 이벤트") — userId는 비로그인 이벤트도 남길 수 있도록 관계 없는 문자열로 둠
export const marketValidationEvents = sqliteTable("market_validation_events", {
  id: text("id").primaryKey().$defaultFn(cuid),
  eventType: text("event_type").notNull(), // VIEW_LISTING | CLICK_TRY_WANT | SEARCH | WISHLIST_ADD 등
  listingId: text("listing_id"),
  modelId: text("model_id"),
  userId: text("user_id"),
  metadata: text("metadata"), // JSON 문자열
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});
