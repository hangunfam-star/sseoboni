// 탈퇴 1단계(2026-10-26, docs/review/WITHDRAW_PLAN_v7.md). 시험 서버용 — 운영에서는 WITHDRAW_ENABLED가 정확히 "1"이 아니면 꺼져 있다.
// 거래 기록(주문·채팅·후기·분쟁)은 그대로 두고, 로그인을 막고 이름·사진을 가리며 내 데이터 8종을 지운다. 법정 분리 보관·파기는 2단계.
// 탈퇴 요청은 주문 자동 처리(advanceOrders)를 부르지 않는다 — 탈퇴가 남기는 변경은 아래 트랜잭션 하나뿐이다.
// 2단계(2026-10-28, docs/review/WITHDRAW_PLAN_v12.md): 커밋 뒤 retainUser가 거래 기록 속 개인정보를 보관 DB로 옮기고 원래 칸을 비운다.
import { randomBytes } from "node:crypto";
import { statSync } from "node:fs";
import { and, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { db, dbPath } from "@/db/client";
import {
  chatMessages, chatThreads, demandIntents, disputes, listingPhotos, listings, listingTrialTerms, loginLinks, marketValidationEvents, notificationPrefs, notifications,
  orderEvents, orderPhotos, orders, pushSubscriptions, reviews, sellerAccounts, socialAccounts, trialProposals, trialReviews, users, wishlists, withdrawals,
} from "@/db/schema";
import { notifyTx } from "@/lib/notify";
import type { Snapshot } from "@/lib/orders";
import { cleanupUploadOrphans, movePhotoToRetained, photoSourcePaths, removePhotoSources } from "@/lib/photos";
import {
  cleanupRetainedOrphans, markSrcRemoved, pendingFileCount, putValues, retainedCount, srcPendingFiles, withRetainLock,
  type RetainFileIn, type RetainLock, type RetainValueIn,
} from "@/lib/retain";
import { checkItemsFor } from "@/ui/check-items";
import { FINAL_STATUSES, hoursBetween, sqlToIso } from "@/ui/trade-rules";
import { findContactInfo } from "@/ui/trial-pricing";

// param: v 탈퇴 칸에 입력한 값(사유 등 자유 입력, 저장하지 않음). return: 공백 아닌 글자가 있고 500자 이하면 true
export function withdrawConfirmOk(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0 && v.length <= 500;
}
export const WITHDRAWN_NAME = "탈퇴한 사용자";
export const DISPUTE_WINDOW_HOURS = 7 * 24; // 끝난 거래에 분쟁을 열 수 있는 기간(lib/orders.ts 분쟁 열기와 같은 값)

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Runner = Tx | typeof db;

export type Blocker = { orderId: string; title: string; reason: "진행 중" | "분쟁 중" | "분쟁 가능 기간" };
export type WithdrawResult = { ok: true } | { already: true } | { blockers: Blocker[] };

// return: 탈퇴 기능이 켜져 있는지(환경변수가 정확히 "1"일 때만)
export function withdrawEnabled(): boolean {
  return process.env.WITHDRAW_ENABLED === "1";
}

// param: userId, run 트랜잭션(또는 db), nowMs 기준 시각. return: 탈퇴를 막는 거래 목록(없으면 빈 배열)
export function blockersOf(userId: string, run: Runner = db, nowMs = Date.now()): Blocker[] {
  const rows = run.select({ id: orders.id, status: orders.status, completedAt: orders.completedAt, snapshot: orders.snapshot })
    .from(orders).where(or(eq(orders.buyerId, userId), eq(orders.sellerId, userId))).all();
  if (rows.length === 0) return [];
  const openIds = new Set(run.select({ orderId: disputes.orderId }).from(disputes)
    .where(and(eq(disputes.status, "OPEN"), inArray(disputes.orderId, rows.map((r) => r.id)))).all().map((d) => d.orderId));
  const nowIso = new Date(nowMs).toISOString();
  const out: Blocker[] = [];
  for (const r of rows) {
    const title = titleOf(r.snapshot);
    if (!(FINAL_STATUSES as string[]).includes(r.status)) out.push({ orderId: r.id, title, reason: "진행 중" });
    else if (openIds.has(r.id)) out.push({ orderId: r.id, title, reason: "분쟁 중" });
    else if (inDisputeWindow(r.status, r.completedAt, nowIso)) out.push({ orderId: r.id, title, reason: "분쟁 가능 기간" });
  }
  return out;
}

// param: status 주문 상태, completedAt 완료 시각(SQLite 형식 또는 ISO, 없으면 null), nowIso 기준 시각. return: 끝난 거래가 아직 분쟁을 열 수 있는 기간인지(168시간 이하·완료 시각 없음이면 참, 취소는 거짓)
export function inDisputeWindow(status: string, completedAt: string | null, nowIso: string): boolean {
  if (status !== "PURCHASED" && status !== "RETURNED") return false;
  return !completedAt || hoursBetween(sqlToIso(completedAt), nowIso) <= DISPUTE_WINDOW_HOURS;
}

function titleOf(snapshot: string): string {
  try { return String((JSON.parse(snapshot) as { title?: unknown }).title ?? "거래"); } catch { return "거래"; }
}

// 시험 전용 오류 주입(T13). 운영(production)에서는 읽지 않는다.
function fault(at: string): void {
  if (withdrawEnabled() && process.env.NODE_ENV !== "production" && process.env.WITHDRAW_FAULT === at) throw new Error(`WITHDRAW_FAULT:${at}`);
}

// param: userId 로그인한 본인. return: 탈퇴 결과(막는 거래가 있으면 아무것도 바꾸지 않음). 예외가 나면 전체 롤백
export function withdrawUser(userId: string): WithdrawResult {
  return db.transaction((tx): WithdrawResult => {
    const me = tx.select({ status: users.status, nickname: users.nickname }).from(users).where(eq(users.id, userId)).get();
    if (!me || me.status !== "ACTIVE") return { already: true };
    const blockers = blockersOf(userId, tx);
    if (blockers.length > 0) return { blockers };
    if (tx.update(users).set({ status: "WITHDRAWN" }).where(and(eq(users.id, userId), eq(users.status, "ACTIVE"))).run().changes !== 1) return { already: true };

    // 원래 값을 먼저 읽어 둔다(이름·답글을 지우기 전에 상대 알림을 찾아야 함)
    const nick = me.nickname;
    const threads = tx.select({ id: chatThreads.id, listingId: chatThreads.listingId, buyerId: chatThreads.buyerId, sellerId: chatThreads.sellerId }).from(chatThreads)
      .where(or(eq(chatThreads.buyerId, userId), eq(chatThreads.sellerId, userId))).all();
    const myListings = tx.select({ id: listings.id, title: listings.title }).from(listings).where(eq(listings.sellerId, userId)).all();
    const myListingIds = myListings.map((l) => l.id);
    const titleById = new Map(myListings.map((l) => [l.id, l.title]));
    const props = tx.select().from(trialProposals)
      .where(myListingIds.length > 0 ? or(eq(trialProposals.buyerId, userId), inArray(trialProposals.listingId, myListingIds)) : eq(trialProposals.buyerId, userId)).all();
    const used = new Set(props.length === 0 ? [] : tx.select({ id: orders.proposalId }).from(orders)
      .where(and(isNotNull(orders.proposalId), inArray(orders.proposalId, props.map((p) => p.id)))).all().map((o) => o.id));

    // 바꿀 상대 알림의 id를 먼저 고른다(받는 사람·주소·본문이 모두 맞는 줄만)
    const ids = (userIdOf: string, url: string, body: string) => tx.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, userIdOf), eq(notifications.url, url), eq(notifications.body, body))).all().map((n) => n.id);
    const chatNoteIds = nick ? threads.flatMap((t) => ids(t.buyerId === userId ? t.sellerId : t.buyerId, `/chats/${t.id}`, `${nick}님이 메시지를 보냈어요.`)) : [];
    const declineNoteIds = props.filter((p) => titleById.has(p.listingId) && p.sellerReply)
      .flatMap((p) => ids(p.buyerId, `/listings/${p.listingId}`, `판매자가 제안을 거절했어요. "${p.sellerReply}"`));

    // P7 상대 알림: 고른 id만 바꾼다
    if (chatNoteIds.length > 0) tx.update(notifications).set({ body: `${WITHDRAWN_NAME}님이 메시지를 보냈어요.` }).where(inArray(notifications.id, chatNoteIds)).run();
    if (declineNoteIds.length > 0) tx.update(notifications).set({ body: "판매자가 제안을 거절했어요." }).where(inArray(notifications.id, declineNoteIds)).run();

    // P6 제안: 대기 중이거나 주문에 쓰이지 않은 승인만 취소, 내가 쓴 글은 상태와 상관없이 비움
    for (const p of props) {
      const mineListing = titleById.has(p.listingId);
      const cancel = p.status === "PENDING" || (p.status === "ACCEPTED" && !used.has(p.id));
      const patch: Partial<typeof trialProposals.$inferInsert> = {};
      if (cancel) { patch.status = "CANCELLED"; patch.decidedAt = sql`current_timestamp` as unknown as string; }
      if (p.buyerId === userId && p.message) patch.message = null;
      if (mineListing && p.sellerReply) patch.sellerReply = null;
      if (Object.keys(patch).length > 0) tx.update(trialProposals).set(patch).where(eq(trialProposals.id, p.id)).run();
      if (cancel && mineListing && p.buyerId !== userId) {
        notifyTx(tx, p.buyerId, { category: "TRADE", title: `써보기 제안 취소 · ${titleById.get(p.listingId)}`, body: "판매자가 탈퇴해 제안이 취소됐어요.", url: "/me", dedupeKey: `withdraw-proposal-${p.id}` });
      }
    }
    fault("after_p6");

    // P3 이름·사진 가리기
    tx.update(users).set({ nickname: WITHDRAWN_NAME, kakaoImageUrl: null, showPhoto: false, withdrawnAt: sql`current_timestamp` as unknown as string }).where(eq(users.id, userId)).run();

    // P4 내 데이터 지우기
    tx.delete(socialAccounts).where(eq(socialAccounts.userId, userId)).run();
    tx.delete(loginLinks).where(eq(loginLinks.userId, userId)).run();
    tx.delete(sellerAccounts).where(eq(sellerAccounts.userId, userId)).run();
    tx.delete(wishlists).where(eq(wishlists.userId, userId)).run();
    tx.delete(demandIntents).where(eq(demandIntents.userId, userId)).run();
    tx.delete(notifications).where(eq(notifications.userId, userId)).run();
    tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).run();
    tx.delete(notificationPrefs).where(eq(notificationPrefs.userId, userId)).run();

    // P5 상품 내리기(판매된 상품은 그대로)
    if (myListingIds.length > 0) tx.update(listings).set({ status: "REMOVED" })
      .where(and(eq(listings.sellerId, userId), inArray(listings.status, ["ACTIVE", "HIDDEN", "RESERVED"]))).run();

    // 2단계: 보관 이동 대기 표시(커밋 뒤 retainUser가 이어서 한다)
    tx.insert(withdrawals).values({ userId, stage: "RETAIN_PENDING" }).onConflictDoNothing().run();

    // 2단계: 주문 없는 방의 내 채팅 본문은 보존 근거가 없어 바로 바꾼다(보관 안 함)
    for (const t of threads) {
      const traded = tx.select({ id: orders.id }).from(orders).where(and(eq(orders.listingId, t.listingId), eq(orders.buyerId, t.buyerId))).get();
      if (!traded) tx.update(chatMessages).set({ body: WITHDRAWN_MSG }).where(and(eq(chatMessages.threadId, t.id), eq(chatMessages.senderId, userId), eq(chatMessages.kind, "USER"))).run();
    }

    // 2단계: 후기 속 연락처(findContactInfo에 걸린 칸만 비움)
    const hit = (s: string | null) => Boolean(s && findContactInfo(s));
    for (const r of tx.select({ id: reviews.id, body: reviews.body }).from(reviews).where(eq(reviews.writerId, userId)).all()) {
      if (hit(r.body)) tx.update(reviews).set({ body: null }).where(eq(reviews.id, r.id)).run();
    }
    for (const r of tx.select().from(trialReviews).where(eq(trialReviews.writerId, userId)).all()) {
      const patch: Partial<typeof trialReviews.$inferInsert> = {};
      if (hit(r.answers)) patch.answers = null;
      if (hit(r.reason)) patch.reason = null;
      if (hit(r.learned)) patch.learned = null;
      if (hit(r.fitFor)) patch.fitFor = null;
      if (Object.keys(patch).length > 0) tx.update(trialReviews).set(patch).where(eq(trialReviews.id, r.id)).run();
    }

    // 2단계: 통계 기록 metadata — 내 의견 글 비움, 신고 대상·로그인 링크 대상 id는 새 가명(원래 id와 연결 저장 안 함)
    const meta = (s: string | null): Record<string, unknown> | null => { try { const v = JSON.parse(s ?? ""); return v && typeof v === "object" ? v : null; } catch { return null; } };
    for (const e of tx.select({ id: marketValidationEvents.id, type: marketValidationEvents.eventType, userId: marketValidationEvents.userId, metadata: marketValidationEvents.metadata }).from(marketValidationEvents)
      .where(or(and(eq(marketValidationEvents.userId, userId), eq(marketValidationEvents.eventType, "FEEDBACK")),
        and(inArray(marketValidationEvents.eventType, ["CHAT_REPORT", "LOGIN_LINK_ISSUED"]), sql`instr(${marketValidationEvents.metadata}, ${userId}) > 0`))).all()) {
      const m = meta(e.metadata);
      if (!m) continue;
      if (e.type === "FEEDBACK" && e.userId === userId && m.message) m.message = null;
      else if (e.type === "CHAT_REPORT" && m.reportedUserId === userId) m.reportedUserId = pseudonym();
      else if (e.type === "LOGIN_LINK_ISSUED" && m.userId === userId) m.userId = pseudonym();
      else continue;
      tx.update(marketValidationEvents).set({ metadata: JSON.stringify(m) }).where(eq(marketValidationEvents.id, e.id)).run();
    }

    // P9 통계 기록의 사용자 id → 가명(원래 id와 연결해 저장하지 않음)
    tx.update(marketValidationEvents).set({ userId: pseudonym() }).where(eq(marketValidationEvents.userId, userId)).run();
    return { ok: true };
  });
}

const pseudonym = () => `wd_${randomBytes(16).toString("hex")}`;

// ───────────── 탈퇴 2단계: 보관 이동(docs/review/WITHDRAW_PLAN_v12.md 2절·3절) ─────────────
export const WITHDRAWN_LISTING = "탈퇴한 판매자의 상품";
export const WITHDRAWN_MSG = "(탈퇴한 사용자의 메시지)";
export const WITHDRAWN_MEMO = "(탈퇴한 사용자의 메모)";
export const RETAIN_LEASE_MS = 5 * 60_000; // 처리 중 표시 기한

// 시험 전용: retainUser ①·②·③·④ 단계 뒤에 끼워 넣기(멈춤 흉내)
export const withdrawHooks: { afterStep?: (n: number) => void } = {};

class LeaseLost extends Error { constructor() { super("RETAIN_LEASE_LOST"); } }

const msOf = (s: string | null | undefined): number | null => (s ? new Date(sqlToIso(s)).getTime() : null);
const addMonths = (ms: number, n: number) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() + n); return d.getTime(); };
const addYears = (ms: number, n: number) => { const d = new Date(ms); d.setUTCFullYear(d.getUTCFullYear() + n); return d.getTime(); };

type RetainPlan = { values: RetainValueIn[]; files: Omit<RetainFileIn, "srcPaths">[]; apply: ((tx: Tx) => void)[] };

// param: json 점검 기록(받을 때·반송 전·검수). return: 메모·사진 이름을 뺀 JSON(구성품 결과는 남김), 읽을 수 없으면 null
function stripCheck(json: string): string | null {
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    if (!v || typeof v !== "object") return null;
    return JSON.stringify({ ...v, note: "", photos: [] });
  } catch { return null; }
}
const noteOf = (json: string | null): string => { try { const n = (JSON.parse(json ?? "") as { note?: unknown }).note; return typeof n === "string" ? n.trim() : ""; } catch { return ""; } };

// param: json 주문 스냅숏. return: 판매자 원문 칸만 바꾼 스냅숏(구조·가격·구성품·모델 등은 그대로, 0000절 5)
export function stripSnapshot(json: string): string {
  let s: Snapshot;
  try { s = JSON.parse(json) as Snapshot; } catch { return json; }
  const items = checkItemsFor(s.category);
  const checks = Array.isArray(s.checks) ? s.checks.map((c) => {
    const opts = items.find((i) => i.key === c.key)?.options;
    return opts && opts.includes(c.value) ? c : { ...c, value: "" }; // 고르는 칸은 그대로, 자유 입력 칸은 비움
  }) : s.checks;
  return JSON.stringify({ ...s, title: WITHDRAWN_LISTING, description: "", photo: null, conditionNote: null, ...(checks !== undefined ? { checks } : {}) });
}

// param: tx, userId, nowMs. return: 보관할 값·사진과 운영 DB에서 비울 일(①)
function planFor(tx: Tx, userId: string, nowMs: number): RetainPlan {
  const plan: RetainPlan = { values: [], files: [], apply: [] };
  const wd = tx.select().from(withdrawals).where(eq(withdrawals.userId, userId)).get();
  const wAt = msOf(wd?.withdrawnAt) ?? nowMs;
  const keep = (srcTable: string, srcId: string, col: string, value: string | null | undefined, expiresMs: number) => {
    if (value != null && value !== "") plan.values.push({ userId, srcTable, srcId, col, value, expiresMs });
  };

  // 상품(1호, 탈퇴일+6개월)
  const l1 = addMonths(wAt, 6);
  const myListings = tx.select({ id: listings.id, title: listings.title, description: listings.description, checkItems: listings.checkItems }).from(listings).where(eq(listings.sellerId, userId)).all();
  const titles = new Set<string>();
  for (const l of myListings) {
    if (l.title !== WITHDRAWN_LISTING) titles.add(l.title);
    if (l.title === WITHDRAWN_LISTING && l.description === "" && l.checkItems === null) continue;
    keep("listings", l.id, "title", l.title === WITHDRAWN_LISTING ? null : l.title, l1);
    keep("listings", l.id, "description", l.description, l1);
    keep("listings", l.id, "check_items", l.checkItems, l1);
    plan.apply.push((t) => t.update(listings).set({ title: WITHDRAWN_LISTING, description: "", checkItems: null }).where(eq(listings.id, l.id)).run());
  }
  const lids = myListings.map((l) => l.id);
  if (lids.length > 0) {
    const photos = tx.select({ id: listingPhotos.id, fileName: listingPhotos.fileName }).from(listingPhotos).where(inArray(listingPhotos.listingId, lids)).all();
    for (const p of photos) plan.files.push({ userId, kind: "listing", srcId: p.id, fileName: p.fileName, expiresMs: l1 });
    if (photos.length > 0) plan.apply.push((t) => t.delete(listingPhotos).where(inArray(listingPhotos.id, photos.map((p) => p.id))).run());
    for (const tt of tx.select({ id: listingTrialTerms.listingId, note: listingTrialTerms.conditionNote }).from(listingTrialTerms).where(inArray(listingTrialTerms.listingId, lids)).all()) {
      if (!tt.note) continue;
      keep("listing_trial_terms", tt.id, "condition_note", tt.note, l1);
      plan.apply.push((t) => t.update(listingTrialTerms).set({ conditionNote: null }).where(eq(listingTrialTerms.listingId, tt.id)).run());
    }
  }

  // 거래(2호·3호 5년, 분쟁 4호 3년 — 같은 자료면 긴 쪽)
  const myOrders = tx.select().from(orders).where(or(eq(orders.buyerId, userId), eq(orders.sellerId, userId))).all();
  const oids = myOrders.map((o) => o.id);
  const disp = oids.length ? tx.select().from(disputes).where(inArray(disputes.orderId, oids)).all() : [];
  const endOf = new Map<string, number>();
  const memos = new Map<string, string[]>(); // 주문 id → 탈퇴자가 쓴 메모(SYSTEM 채팅에서 찾아 바꿈)
  for (const o of myOrders) {
    const end = msOf(o.completedAt) ?? wAt;
    endOf.set(o.id, end);
    const y5 = addYears(end, 5);
    const d3 = disp.filter((d) => d.orderId === o.id).map((d) => addYears(msOf(d.resolvedAt) ?? wAt, 3));
    const photoExp = Math.max(y5, ...d3);
    const set: Partial<typeof orders.$inferInsert> = {};
    const move = <K extends keyof typeof orders.$inferInsert>(col: string, key: K, value: string | null, to: (typeof orders.$inferInsert)[K]) => {
      if (value == null || value === "" || value === to) return;
      keep("orders", o.id, col, value, y5);
      set[key] = to;
    };
    const notes: string[] = [];
    if (o.sellerId === userId) {
      const snap = stripSnapshot(o.snapshot);
      if (snap !== o.snapshot) { keep("orders", o.id, "snapshot", o.snapshot, y5); set.snapshot = snap; }
      move("seller_account_enc", "sellerAccountEnc", o.sellerAccountEnc, null);
      move("ship_tracking", "shipTracking", o.shipTracking, null);
      if (o.inspection) { const st = stripCheck(o.inspection); if (st !== o.inspection) { notes.push(noteOf(o.inspection)); move("inspection", "inspection", o.inspection, st); } }
    }
    if (o.buyerId === userId) {
      move("questions", "questions", o.questions, null);
      move("return_note", "returnNote", o.returnNote, null);
      move("deposit_name", "depositName", o.depositName, WITHDRAWN_NAME);
      move("ship_enc", "shipEnc", o.shipEnc, "");
      move("refund_enc", "refundEnc", o.refundEnc, null);
      move("return_tracking", "returnTracking", o.returnTracking, null);
      for (const [col, key] of [["arrival_check", "arrivalCheck"], ["pack_check", "packCheck"]] as const) {
        const v = o[key];
        if (!v) continue;
        const st = stripCheck(v);
        if (st !== v) { notes.push(noteOf(v)); move(col, key, v, st); }
      }
    }
    move("cancel_reason", "cancelReason", o.cancelReason, null);
    if (Object.keys(set).length > 0) plan.apply.push((t) => t.update(orders).set(set).where(eq(orders.id, o.id)).run());
    memos.set(o.id, notes.filter((n) => n.length > 0));

    // 내가 올린 거래 사진
    const ops = tx.select({ id: orderPhotos.id, fileName: orderPhotos.fileName }).from(orderPhotos).where(and(eq(orderPhotos.orderId, o.id), eq(orderPhotos.userId, userId))).all();
    for (const p of ops) plan.files.push({ userId, kind: "order", srcId: p.id, fileName: p.fileName, expiresMs: photoExp });
    if (ops.length > 0) plan.apply.push((t) => t.delete(orderPhotos).where(inArray(orderPhotos.id, ops.map((p) => p.id))).run());

    // 내가 쓴 취소 사유(거래 기록)
    for (const e of tx.select().from(orderEvents).where(and(eq(orderEvents.orderId, o.id), eq(orderEvents.actorId, userId), eq(orderEvents.type, "CANCELLED"))).all()) {
      let d: Record<string, unknown>;
      try { d = JSON.parse(e.data ?? "") as Record<string, unknown>; } catch { continue; }
      if (typeof d.reason !== "string" || d.reason === "") continue;
      keep("order_events", e.id, "data", e.data, y5);
      plan.apply.push((t) => t.update(orderEvents).set({ data: JSON.stringify({ ...d, reason: "" }) }).where(eq(orderEvents.id, e.id)).run());
    }
    if (o.sellerId === userId) titles.add(titleOf(o.snapshot));
  }
  // 분쟁 상세(내가 연 것)
  for (const d of disp.filter((x) => x.openerId === userId && x.detail)) {
    keep("disputes", d.id, "detail", d.detail, addYears(msOf(d.resolvedAt) ?? wAt, 3));
    plan.apply.push((t) => t.update(disputes).set({ detail: null }).where(eq(disputes.id, d.id)).run());
  }

  // 채팅: 주문 있는 방의 내 메시지(2호), SYSTEM 메시지 속 내 메모
  const threads = tx.select().from(chatThreads).where(or(eq(chatThreads.buyerId, userId), eq(chatThreads.sellerId, userId))).all();
  for (const th of threads) {
    const tOrders = myOrders.filter((o) => o.listingId === th.listingId && o.buyerId === th.buyerId);
    if (tOrders.length === 0) continue;
    const y5 = addYears(Math.max(...tOrders.map((o) => endOf.get(o.id)!)), 5);
    for (const m of tx.select({ id: chatMessages.id, body: chatMessages.body }).from(chatMessages).where(and(eq(chatMessages.threadId, th.id), eq(chatMessages.senderId, userId), eq(chatMessages.kind, "USER"))).all()) {
      if (m.body === WITHDRAWN_MSG) continue;
      keep("chat_messages", m.id, "body", m.body, y5);
      plan.apply.push((t) => t.update(chatMessages).set({ body: WITHDRAWN_MSG }).where(eq(chatMessages.id, m.id)).run());
    }
    const notes = tOrders.flatMap((o) => memos.get(o.id) ?? []);
    if (notes.length === 0) continue;
    for (const m of tx.select({ id: chatMessages.id, body: chatMessages.body }).from(chatMessages).where(and(eq(chatMessages.threadId, th.id), eq(chatMessages.kind, "SYSTEM"))).all()) {
      let body = m.body;
      for (const n of notes) body = body.split(n).join(WITHDRAWN_MEMO);
      if (body === m.body) continue;
      keep("chat_messages", m.id, "body", m.body, y5);
      plan.apply.push((t) => t.update(chatMessages).set({ body }).where(eq(chatMessages.id, m.id)).run());
    }
  }

  // 상대방 알림: 탈퇴 판매자 상품·주문·채팅방을 가리키는 알림의 상품 제목(보존 근거 없음, 보관 안 함)
  titles.delete(""); titles.delete("거래"); titles.delete(WITHDRAWN_LISTING);
  const urls = [...lids.map((id) => `/listings/${id}`), ...myOrders.filter((o) => o.sellerId === userId).map((o) => `/orders/${o.id}`), ...threads.filter((t) => t.sellerId === userId).map((t) => `/chats/${t.id}`)];
  if (titles.size > 0 && urls.length > 0) {
    const sorted = [...titles].sort((a, b) => b.length - a.length);
    for (const n of tx.select({ id: notifications.id, title: notifications.title, body: notifications.body }).from(notifications).where(inArray(notifications.url, urls)).all()) {
      let title = n.title, body = n.body;
      for (const s of sorted) { title = title.split(s).join(WITHDRAWN_LISTING); body = body.split(s).join(WITHDRAWN_LISTING); }
      if (title !== n.title || body !== n.body) plan.apply.push((t) => t.update(notifications).set({ title, body }).where(eq(notifications.id, n.id)).run());
    }
  }
  return plan;
}

export type RetainOutcome = "RETAINED" | "WIPE_PENDING" | "BUSY" | "LOCKED" | "FILES_PENDING";

// param: userId 탈퇴자, nowMs 기준 시각. return: 처리 결과. 2절 상태기계(RETAIN_PENDING → RETAINING → WIPE_PENDING → RETAINED)
export function retainUser(userId: string, nowMs = Date.now()): RetainOutcome {
  return withRetainLock((lock): RetainOutcome => {
    const owner = randomBytes(12).toString("hex");
    // ⓪·①: 처리 중 표시를 잡고 같은 트랜잭션에서 대상 값을 읽는다
    const plan = db.transaction((tx) => {
      const r = tx.update(withdrawals).set({ stage: "RETAINING", leaseOwner: owner, leaseUntil: nowMs + RETAIN_LEASE_MS, updatedAt: sql`(current_timestamp)` as unknown as string })
        .where(and(eq(withdrawals.userId, userId), or(eq(withdrawals.stage, "RETAIN_PENDING"), and(eq(withdrawals.stage, "RETAINING"), lt(withdrawals.leaseUntil, nowMs))))).run();
      return r.changes === 1 ? planFor(tx, userId, nowMs) : null;
    });
    if (!plan) return "BUSY";
    withdrawHooks.afterStep?.(1);
    // ② 보관 DB에 값(INSERT OR IGNORE, 만료된 것은 넣지 않음)
    putValues(lock, plan.values, nowMs);
    withdrawHooks.afterStep?.(2);
    // ③ 사진을 암호화해 보관 폴더로
    for (const f of plan.files) movePhotoToRetained(lock, f, nowMs);
    withdrawHooks.afterStep?.(3);
    if (pendingFileCount(userId) > 0) return "FILES_PENDING";
    // ④ 운영 DB: 원래 칸 비우기·사진 줄 삭제·알림 제목 — 내 lease일 때만
    db.transaction((tx) => {
      for (const a of plan.apply) a(tx);
      const w = tx.update(withdrawals).set({ stage: "WIPE_PENDING", leaseOwner: null, leaseUntil: null, updatedAt: sql`(current_timestamp)` as unknown as string })
        .where(and(eq(withdrawals.userId, userId), eq(withdrawals.stage, "RETAINING"), eq(withdrawals.leaseOwner, owner))).run();
      if (w.changes !== 1) throw new LeaseLost();
    });
    withdrawHooks.afterStep?.(4);
    return finishWipe(lock, userId);
  }) ?? "LOCKED";
}

// param: lock, userId. return: RETAINED 또는 WIPE_PENDING. ⑤ 원본 사진 지우기(결과 확인) ⑥ wal_checkpoint(TRUNCATE) busy=0·-wal 0바이트일 때만 RETAINED
function finishWipe(lock: RetainLock, userId: string): "RETAINED" | "WIPE_PENDING" {
  let left = 0;
  for (const f of srcPendingFiles(userId)) {
    if (removePhotoSources(f.fileName, f.kind)) markSrcRemoved(lock, userId, f.kind, f.fileName);
    else left++;
  }
  if (left > 0) return "WIPE_PENDING";
  const sqlite = db.$client;
  const [cp] = sqlite.pragma("wal_checkpoint(TRUNCATE)") as { busy: number; log: number; checkpointed: number }[];
  let walBytes = 0;
  try { walBytes = statSync(`${dbPath}-wal`).size; } catch { walBytes = 0; }
  if (!cp || cp.busy !== 0 || walBytes !== 0) return "WIPE_PENDING";
  db.update(withdrawals).set({ stage: "RETAINED", updatedAt: sql`(current_timestamp)` as unknown as string }).where(and(eq(withdrawals.userId, userId), eq(withdrawals.stage, "WIPE_PENDING"))).run();
  return "RETAINED";
}

// param: nowMs. return: 처리한 탈퇴자 수. 정기 작업: RETAIN_PENDING·기한 지난 RETAINING은 retainUser, WIPE_PENDING은 ⑤·⑥만. 보관분이 모두 파기된 RETAINED 줄은 지운다
export function retainPending(nowMs = Date.now()): number {
  const rows = db.select({ userId: withdrawals.userId, stage: withdrawals.stage }).from(withdrawals)
    .where(or(inArray(withdrawals.stage, ["RETAIN_PENDING", "WIPE_PENDING"]), and(eq(withdrawals.stage, "RETAINING"), lt(withdrawals.leaseUntil, nowMs)))).all();
  let n = 0;
  for (const r of rows) {
    try {
      const out = r.stage === "WIPE_PENDING" ? withRetainLock((lock) => finishWipe(lock, r.userId)) : retainUser(r.userId, nowMs);
      if (out === "RETAINED") n++;
    } catch (e) { console.error(`[withdraw] 보관 이동 실패 ${r.userId}`, e); }
  }
  for (const r of db.select({ userId: withdrawals.userId }).from(withdrawals).where(eq(withdrawals.stage, "RETAINED")).all()) {
    if (retainedCount(r.userId) === 0) db.delete(withdrawals).where(and(eq(withdrawals.userId, r.userId), eq(withdrawals.stage, "RETAINED"))).run();
  }
  return n;
}

// param: nowMs. return: 정리한 고아 파일 수(업로드 staging·원래 폴더 + 잠금 안에서 보관 폴더·백업 tmp)
// 개발 서버(next dev)에서는 업로드 폴더 정리를 하지 않는다: 이 PC는 여러 시험 DB가 runtime-data/uploads를 같이 써서,
// 한 DB에 없는 파일을 지우면 다른 DB의 사진이 사라진다(2026-10-28 격리 시험이 시뮬레이션 사진 16개를 지운 일).
export function cleanupOrphans(nowMs = Date.now()): number {
  const uploads = process.env.NODE_ENV === "development" ? 0 : cleanupUploadOrphans(nowMs);
  return uploads + (withRetainLock((lock) => cleanupRetainedOrphans(lock, nowMs, (k, f) => photoSourcePaths(f, k))) ?? 0);
}
