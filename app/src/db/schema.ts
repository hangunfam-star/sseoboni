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
  kind: text("kind").notNull().default("USER"), // USER | SYSTEM(거래 진행 안내)
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [
  index("chat_messages_thread_seq").on(t.threadId, t.seq),
  uniqueIndex("chat_messages_seq_unique").on(t.seq),
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

// ── 거래(2026-10-09, 사용자 결정: 구매자-판매자 직접 정산. 써보니는 돈을 받지 않고 계산·안내·기록만 한다) ──

// 판매자 정산 계좌·기본 배송비. 계좌번호는 암호화해 저장한다(본인·거래 상대 구매자에게만 보임).
export const sellerAccounts = sqliteTable("seller_accounts", {
  userId: text("user_id").primaryKey().references(() => users.id),
  bank: text("bank").notNull(),
  accountEnc: text("account_enc").notNull(),
  holder: text("holder").notNull(),
  defaultShipping: integer("default_shipping").notNull().default(0), // 기본 발송비(원). 써보기 조건에 배송비가 없을 때 쓴다
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

// 거래 1건(구매 BUY / 써보기 TRIAL). 신청 시점 상품 설명·조건을 snapshot에 저장하고 이후 수정은 소급하지 않는다.
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey().$defaultFn(cuid),
  listingId: text("listing_id").notNull().references(() => listings.id),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  sellerId: text("seller_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // BUY | TRIAL
  status: text("status").notNull(), // AWAIT_PAYMENT | PAID | SHIPPED | RECEIVED | TRIAL | NEEDS_CHECK | RETURN_REQUESTED | RETURN_SHIPPED | REFUND_DUE | REFUND_SENT | PURCHASED | RETURNED | CANCELLED
  snapshot: text("snapshot").notNull(), // JSON: 제목·가격·상태·설명·구성품·조건
  price: integer("price").notNull(),
  shippingFee: integer("shipping_fee").notNull().default(0), // 구매자 부담 발송비(최초 결제금에 포함)
  tiers: text("tiers"), // TRIAL: 신청 시점 구간별 체험료 JSON
  trialHours: integer("trial_hours"),
  trialFee: integer("trial_fee"), // 고른 구간 체험료(반납 때만)
  proposalId: text("proposal_id"),
  questions: text("questions"), // 체험 전 궁금한 점 JSON(최대 3)
  depositName: text("deposit_name").notNull(), // 입금자명
  shipEnc: text("ship_enc").notNull(), // 배송지 JSON(암호화). 판매자는 입금 확인 뒤에만 본다
  refundEnc: text("refund_enc"), // 환불 받을 계좌 JSON(암호화). 반납·취소 때 구매자가 입력
  shipCarrier: text("ship_carrier"),
  shipTracking: text("ship_tracking"),
  returnReason: text("return_reason"),
  returnNote: text("return_note"),
  returnCarrier: text("return_carrier"),
  returnTracking: text("return_tracking"),
  returnHandoverAt: text("return_handover_at"), // 구매자가 택배사에 맡긴 날(YYYY-MM-DD)
  inspection: text("inspection"), // JSON: 구성품별 반환 여부·메모
  refundKind: text("refund_kind"), // RETURN | CANCEL
  refundAmount: integer("refund_amount"),
  feePct: real("fee_pct"), // 구매 확정 시점 수수료율
  feeAmount: integer("fee_amount"), // 실제 청구 대상 수수료(베타 0%면 0)
  virtualFee: integer("virtual_fee"), // 정식 수수료(3%)였다면 — 지불 의향 측정용 기록
  cancelReason: text("cancel_reason"),
  opsFlag: text("ops_flag"), // 운영 확인 필요 사유(기한 초과 등)
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  paidAt: text("paid_at"),
  shippedAt: text("shipped_at"),
  receivedAt: text("received_at"),
  trialEndAt: text("trial_end_at"),
  needsCheckAt: text("needs_check_at"),
  decidedAt: text("decided_at"),
  returnRequestedAt: text("return_requested_at"),
  returnShippedAt: text("return_shipped_at"),
  inspectedAt: text("inspected_at"),
  refundSentAt: text("refund_sent_at"),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [
  index("orders_buyer").on(t.buyerId),
  index("orders_seller").on(t.sellerId),
  index("orders_listing").on(t.listingId),
  index("orders_status").on(t.status),
]);

// 거래 기록(시간순). 상태 변화·금액 확정을 남긴다.
export const orderEvents = sqliteTable("order_events", {
  id: text("id").primaryKey().$defaultFn(cuid),
  orderId: text("order_id").notNull().references(() => orders.id),
  actorId: text("actor_id"), // 자동 처리면 null
  type: text("type").notNull(),
  data: text("data"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [index("order_events_order").on(t.orderId)]);

// 분쟁. 거래 진행 상태와 별도. 열려 있는 동안 자동 처리와 정산을 멈춘다.
export const disputes = sqliteTable("disputes", {
  id: text("id").primaryKey().$defaultFn(cuid),
  orderId: text("order_id").notNull().references(() => orders.id),
  openerId: text("opener_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  detail: text("detail"),
  status: text("status").notNull().default("OPEN"), // OPEN | RESOLVED
  resolution: text("resolution"),
  buyerFault: integer("buyer_fault", { mode: "boolean" }), // 운영자가 확인한 구매자 책임(훼손 등)
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  resolvedAt: text("resolved_at"),
}, (t) => [index("disputes_order").on(t.orderId)]);

// 거래 평가(구매자↔판매자 교차). 둘 다 쓰거나 7일이 지나면 공개.
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey().$defaultFn(cuid),
  orderId: text("order_id").notNull().references(() => orders.id),
  writerId: text("writer_id").notNull().references(() => users.id),
  targetId: text("target_id").notNull().references(() => users.id),
  direction: text("direction").notNull(), // B2S(구매자→판매자) | S2B
  stars: integer("stars").notNull(), // 1~10
  chips: text("chips").notNull(), // JSON 문구
  sample: text("sample"),
  body: text("body"),
  descMatch: integer("desc_match", { mode: "boolean" }), // B2S: 설명과 실제가 같았나
  compMatch: integer("comp_match", { mode: "boolean" }), // B2S: 구성품 안내가 맞았나
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [uniqueIndex("reviews_order_writer").on(t.orderId, t.writerId), index("reviews_target").on(t.targetId)]);

// 써보니 후기(수령이 확인된 체험 거래의 구매자만). 같은 모델끼리 모아 보여 준다.
export const trialReviews = sqliteTable("trial_reviews", {
  id: text("id").primaryKey().$defaultFn(cuid),
  orderId: text("order_id").notNull().references(() => orders.id),
  writerId: text("writer_id").notNull().references(() => users.id),
  modelId: text("model_id").notNull().references(() => productModels.id),
  outcome: text("outcome").notNull(), // PURCHASED | RETURNED
  hours: integer("hours").notNull(),
  answers: text("answers"), // JSON [{q,a}]
  reason: text("reason"),
  learned: text("learned"),
  fitFor: text("fit_for"),
  conditionGrade: text("condition_grade"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [uniqueIndex("trial_reviews_order").on(t.orderId), index("trial_reviews_model").on(t.modelId)]);

// 활동 경험치. 거래번호·회원·종류 기준 한 번만.
export const xpAwards = sqliteTable("xp_awards", {
  id: text("id").primaryKey().$defaultFn(cuid),
  userId: text("user_id").notNull().references(() => users.id),
  orderId: text("order_id").notNull().references(() => orders.id),
  role: text("role").notNull(), // BUYER | SELLER
  kind: text("kind").notNull(), // TRADE_DONE
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (t) => [uniqueIndex("xp_awards_once").on(t.orderId, t.userId, t.kind)]);
