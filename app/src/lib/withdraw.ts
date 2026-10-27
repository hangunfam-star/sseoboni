// 탈퇴 1단계(2026-10-26, docs/review/WITHDRAW_PLAN_v7.md). 시험 서버용 — 운영에서는 WITHDRAW_ENABLED가 정확히 "1"이 아니면 꺼져 있다.
// 거래 기록(주문·채팅·후기·분쟁)은 그대로 두고, 로그인을 막고 이름·사진을 가리며 내 데이터 8종을 지운다. 법정 분리 보관·파기는 2단계.
// 탈퇴 요청은 주문 자동 처리(advanceOrders)를 부르지 않는다 — 탈퇴가 남기는 변경은 아래 트랜잭션 하나뿐이다.
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  chatThreads, demandIntents, disputes, listings, loginLinks, marketValidationEvents, notificationPrefs, notifications, orders,
  pushSubscriptions, sellerAccounts, socialAccounts, trialProposals, users, wishlists,
} from "@/db/schema";
import { notifyTx } from "@/lib/notify";
import { FINAL_STATUSES, hoursBetween, sqlToIso } from "@/ui/trade-rules";

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
    const threads = tx.select({ id: chatThreads.id, buyerId: chatThreads.buyerId, sellerId: chatThreads.sellerId }).from(chatThreads)
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

    // P9 통계 기록의 사용자 id → 가명(원래 id와 연결해 저장하지 않음)
    tx.update(marketValidationEvents).set({ userId: `wd_${randomBytes(16).toString("hex")}` }).where(eq(marketValidationEvents.userId, userId)).run();
    return { ok: true };
  });
}
