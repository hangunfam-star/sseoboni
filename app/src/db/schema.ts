// 써보니 — Gate 0 (P0) 스키마 (Drizzle ORM / SQLite)
// 근거: 써보니_Codex_개발_마스터기획_v1.1.md §60(핵심 DB 엔티티), §78(Gate 시스템), §101(MVP 완료 정의)
//
// 의도적으로 제외한 엔티티 (Gate 1/2 승인 전까지 만들지 않음):
//   TrialPolicy, Transaction, ConditionSnapshot, Dispute,
//   Payment, Refund, Settlement, SettlementHold, Chargeback
// 이유: §101 "Validation MVP는 실제 결제·정산·발송을 발생시키지 않는다"

import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const cuid = () => crypto.randomUUID();

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(cuid),
  role: text("role").notNull(), // BUYER | SELLER | BOTH | ADMIN
  nickname: text("nickname"), // 화면 표시용 이름(로그인 식별에 쓰지 않음)
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

// 판매자가 올린 상품 사진. 파일은 runtime-data/uploads에 저장(git 제외)하고, 여기에는 파일 이름과 순서만 둔다.
export const listingPhotos = sqliteTable("listing_photos", {
  id: text("id").primaryKey().$defaultFn(cuid),
  listingId: text("listing_id").notNull().references(() => listings.id),
  fileName: text("file_name").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// 판매자가 상품 등록·수정 때 정하는 써보기 조건(판매자 WTA 신호, §101-5). 상품당 1개.
// 실제 거래·결제는 Gate 2 전까지 없고, 구매자에게는 이 조건으로 계산한 "예상 비용"만 보여 준다.
export const listingTrialTerms = sqliteTable("listing_trial_terms", {
  listingId: text("listing_id").primaryKey().references(() => listings.id),
  hours: text("hours").notNull(), // 고를 수 있는 기간(시간) JSON 배열, 예: [24,48]
  dailyFee: integer("daily_fee").notNull(), // 가장 짧은 구간 체험비(원) — 과거 호환·정렬용
  tierFees: text("tier_fees"), // 구간별 체험비 JSON [{"hours":24,"fee":1000},...] (2026-10-08부터 기준)
  purchaseCreditPct: integer("purchase_credit_pct").notNull().default(0), // 과거 호환용. 정책(2026-10-08): 사면 체험비 0원 → 항상 100 저장
  shippingOneWay: integer("shipping_one_way"), // 편도 배송비 예상(원), 모르면 null
  conditionNote: text("condition_note"), // 조건 메모(조건부 허용일 때)
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

// 구매자가 보내는 써보기 제안(기간·체험비). 판매자가 승인·거절한다. 판매자 조건과 따로 작동한다.
// 결제·배송은 아직 없다(사용자 결정 2026-10-08: PG 불가, 통장 방식은 추후). 승인은 "합의 성사" 기록이다.
export const trialProposals = sqliteTable("trial_proposals", {
  id: text("id").primaryKey().$defaultFn(cuid),
  listingId: text("listing_id").notNull().references(() => listings.id),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  hours: integer("hours").notNull(),
  offerFee: integer("offer_fee").notNull(), // 기간 전체 체험비 제안(원)
  message: text("message"), // 구매자 한마디
  status: text("status").notNull().default("PENDING"), // PENDING | ACCEPTED | DECLINED | CANCELLED | EXPIRED
  sellerReply: text("seller_reply"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  decidedAt: text("decided_at"),
});

// 상품별 구매자-판매자 1:1 채팅방. 구매자가 처음 말을 걸 때 만든다(상품·구매자당 1개).
export const chatThreads = sqliteTable("chat_threads", {
  id: text("id").primaryKey().$defaultFn(cuid),
  listingId: text("listing_id").notNull().references(() => listings.id),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  sellerId: text("seller_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  lastMessageAt: text("last_message_at"),
  buyerReadAt: text("buyer_read_at"),
  sellerReadAt: text("seller_read_at"),
  // 읽음 커서: 마지막으로 화면에 보여 준 메시지의 순번(chat_messages.seq). 시각(초 단위) 대신 순번으로 정확히 센다.
  buyerReadSeq: integer("buyer_read_seq").notNull().default(0),
  sellerReadSeq: integer("seller_read_seq").notNull().default(0),
}, (t) => [
  uniqueIndex("chat_threads_listing_buyer").on(t.listingId, t.buyerId),
  index("chat_threads_buyer").on(t.buyerId),
  index("chat_threads_seller").on(t.sellerId),
]);

// 채팅 메시지. 연락처·계좌는 서버에서 막는다. 시장검증 이벤트에는 본문을 남기지 않는다.
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(cuid),
  // 순번: 저장할 때 1씩 커지는 번호(폴링·읽음 커서용). 같은 초에 여러 개가 와도 순서가 정확하다.
  seq: integer("seq").notNull().default(0),
  threadId: text("thread_id").notNull().references(() => chatThreads.id),
  senderId: text("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [
  index("chat_messages_thread_seq").on(t.threadId, t.seq),
  index("chat_messages_sender_created").on(t.senderId, t.createdAt),
]);

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
