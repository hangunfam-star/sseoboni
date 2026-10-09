// 거래(구매·써보기) 처리. 상태는 조건부 갱신(WHERE status = 예상 상태)으로만 바꿔 같은 요청이 두 번 와도 한 번만 반영된다.
// 돈은 구매자가 판매자에게 직접 보낸다. 여기서는 금액 계산·상태·기록·안내 메시지만 다룬다.
import { and, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db/client";
import {
  categories, chatMessages, chatThreads, disputes, listingComponents, listings, orderEvents, orders, productModels,
  sellerAccounts, trialProposals, users, xpAwards,
} from "@/db/schema";
import { nextSeqTx } from "@/lib/chat";
import { open, seal } from "@/lib/crypto-box";
import { photosFor } from "@/lib/photos";
import { feePctNow } from "@/lib/platform-fee-store";
import { getTrialTerms } from "@/lib/trial-terms";
import { loadTradeSettings } from "@/lib/trade-settings-store";
import { findContactInfo, type TrialTier } from "@/ui/trial-pricing";
import {
  FINAL_STATUSES, RETURN_REASONS, kstDateOf, STATUS_LABEL, addHours, allowedActions, depositNameFor, hoursBetween, isFinal, moneyOf,
  parseBankAccount, parseQuestions, parseShipTo, purchaseFees, returnFeeFor, shipInputProblem, sqlToIso,
  type Action, type OrderKind, type OrderStatus, type Role, type TradeSettings,
} from "@/ui/trade-rules";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OrderRow = typeof orders.$inferSelect;
export const SYSTEM_USER = "sys_sseoboni";
export const ORDER_DAILY_MAX = 5;
export const DISPUTE_DAILY_MAX = 5;
const now = () => new Date().toISOString();

export type ShipTo = { name: string; phone: string; address: string; memo: string };
export type BankTo = { bank: string; account: string; holder: string };
export type Snapshot = {
  title: string; price: number; conditionGrade: string; description: string; components: string[]; photo: string | null;
  brand: string | null; modelName: string | null; modelId: string; category: string | null; conditionNote: string | null;
};

export class TradeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// ── 공통 도우미 ──

// param: tx, order, actorId(자동이면 null), type, data. 거래 기록 한 줄
function eventTx(tx: Tx, orderId: string, actorId: string | null, type: string, data?: unknown) {
  tx.insert(orderEvents).values({ orderId, actorId, type, data: data === undefined ? null : JSON.stringify(data) }).run();
}

// param: tx, o 거래, text 안내 문구. 상품 채팅방(없으면 만든다)에 거래 안내 메시지를 남긴다.
function systemMessageTx(tx: Tx, o: Pick<OrderRow, "listingId" | "buyerId" | "sellerId">, text: string) {
  let thread = tx.select().from(chatThreads).where(and(eq(chatThreads.listingId, o.listingId), eq(chatThreads.buyerId, o.buyerId))).get();
  if (!thread) thread = tx.insert(chatThreads).values({ listingId: o.listingId, buyerId: o.buyerId, sellerId: o.sellerId }).returning().get();
  tx.insert(chatMessages).values({ threadId: thread.id, senderId: SYSTEM_USER, body: `[거래] ${text}`, kind: "SYSTEM", seq: nextSeqTx(tx) }).run();
  tx.update(chatThreads).set({ lastMessageAt: sql`(current_timestamp)` }).where(eq(chatThreads.id, thread.id)).run();
}

// param: tx, id, from 예상 상태(들), set 바꿀 값, opts.blockIfDispute 열린 분쟁이 있으면 바꾸지 않음(금액·결과 확정 행동)
// return: 바뀐 행(다른 요청이 먼저 바꿨거나 분쟁이 열려 있으면 null)
function moveTx(tx: Tx, id: string, from: OrderStatus | OrderStatus[], set: Partial<OrderRow>, opts: { blockIfDispute?: boolean } = {}): OrderRow | null {
  const list = Array.isArray(from) ? from : [from];
  const noDispute = opts.blockIfDispute ? sql`not exists (select 1 from disputes d where d.order_id = ${id} and d.status = 'OPEN')` : undefined;
  // 단계가 바뀌면 분쟁으로 늦춘 기한(waitShiftMs)은 그 단계에만 적용했으므로 0으로 되돌린다
  const reset = set.status && set.waitShiftMs === undefined ? { waitShiftMs: 0 } : {};
  return tx.update(orders).set({ ...set, ...reset, updatedAt: now() }).where(and(eq(orders.id, id), inArray(orders.status, list), noDispute)).returning().get() ?? null;
}
const LOCK = { blockIfDispute: true } as const;

// param: listingId. 이 상품의 끝나지 않은 거래를 먼저 정리한다(입금 기한이 지난 거래가 상품을 계속 막지 않게)
async function advanceListing(listingId: string) {
  const ids = (await db.select({ id: orders.id }).from(orders).where(and(eq(orders.listingId, listingId), notInArray(orders.status, FINAL_STATUSES)))).map((r) => r.id);
  if (ids.length) await advanceOrders(ids);
}

// 구매 완료·정상 반납 완료 때 구매자·판매자에게 경험치 1점씩(거래·회원·종류당 한 번)
function awardXpTx(tx: Tx, o: OrderRow) {
  for (const [userId, role] of [[o.buyerId, "BUYER"], [o.sellerId, "SELLER"]] as const) {
    tx.insert(xpAwards).values({ userId, orderId: o.id, role, kind: "TRADE_DONE" }).onConflictDoNothing().run();
  }
}

function releaseListingTx(tx: Tx, listingId: string) {
  tx.update(listings).set({ status: "ACTIVE" }).where(and(eq(listings.id, listingId), eq(listings.status, "RESERVED"))).run();
}

export const disputeOpen = (orderId: string) =>
  Boolean(db.select({ id: disputes.id }).from(disputes).where(and(eq(disputes.orderId, orderId), eq(disputes.status, "OPEN"))).get());

// ── 신청 ──

export type CreateInput = { listingId: string; kind: OrderKind; hours?: number; proposalId?: string; questions?: unknown; shipTo: unknown };

// param: buyerId 구매자, input 신청 내용. return: 만든 거래. 예외: TradeError(안내 문구)
export async function createOrder(buyerId: string, input: CreateInput): Promise<OrderRow> {
  const settings = await loadTradeSettings();
  if (!settings.tradeOpen) throw new TradeError("거래는 아직 열리지 않았어요. 곧 열릴 예정이에요.", 403);
  if (input.kind !== "BUY" && input.kind !== "TRIAL") throw new TradeError("요청 형식이 올바르지 않습니다.");
  await advanceListing(input.listingId);
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, input.listingId) });
  if (!listing || (listing.status !== "ACTIVE" && listing.status !== "RESERVED")) throw new TradeError("상품을 찾을 수 없습니다.", 404);
  if (listing.sellerId === buyerId) throw new TradeError("내 상품은 신청할 수 없어요.");
  if (listing.status === "RESERVED") throw new TradeError("다른 분과 거래 중인 상품이에요.", 409);
  const account = await db.query.sellerAccounts.findFirst({ where: eq(sellerAccounts.userId, listing.sellerId) });
  if (!account) throw new TradeError("판매자가 아직 정산 계좌를 등록하지 않아 거래할 수 없어요. 채팅으로 알려 주세요.", 409);
  const ship = parseShipTo(input.shipTo);
  if (typeof ship === "string") throw new TradeError(ship);
  if (findContactInfo(ship.memo) === "계좌번호" || findContactInfo(ship.memo) === "메신저 아이디" || findContactInfo(ship.memo) === "이메일") throw new TradeError("배송 메모에는 배송 요청만 적어 주세요.");
  const questions = parseQuestions(input.questions);
  if (typeof questions === "string") throw new TradeError(questions);
  const today = db.get<{ n: number }>(sql`select count(*) as n from orders where buyer_id = ${buyerId} and created_at > datetime('now','-1 day')`)?.n ?? 0;
  if (today >= ORDER_DAILY_MAX) throw new TradeError("오늘은 신청을 충분히 했어요. 내일 다시 시도해 주세요.", 429);

  const terms = await getTrialTerms(listing.id);
  let tiers: TrialTier[] | null = null;
  let hours: number | null = null;
  let proposalId: string | null = null;
  if (input.kind === "TRIAL") {
    if (input.proposalId) {
      const p = await db.query.trialProposals.findFirst({ where: eq(trialProposals.id, input.proposalId) });
      if (!p || p.buyerId !== buyerId || p.listingId !== listing.id || p.status !== "ACCEPTED") throw new TradeError("승인된 제안을 찾을 수 없어요.");
      if (p.offerFee > listing.price) throw new TradeError("제안 체험료가 상품 가격보다 커요. 다시 제안해 주세요.");
      tiers = [{ hours: p.hours, fee: p.offerFee }];
      hours = p.hours;
      proposalId = p.id;
    } else {
      if (!terms) throw new TradeError("판매자가 써보기 조건을 정하지 않은 상품이에요. 써보기를 제안해 보세요.");
      tiers = terms.tiers;
      if (!tiers.some((t) => t.hours === input.hours)) throw new TradeError("써볼 기간을 골라 주세요.");
      hours = input.hours as number;
    }
  }
  const model = await db.query.productModels.findFirst({ where: eq(productModels.id, listing.modelId) });
  const category = model ? await db.query.categories.findFirst({ where: eq(categories.id, model.categoryId) }) : undefined;
  const comps = await db.select({ name: listingComponents.name }).from(listingComponents).where(eq(listingComponents.listingId, listing.id));
  const photo = (await photosFor([listing.id])).get(listing.id)?.[0]?.fileName ?? null;
  const buyer = await db.query.users.findFirst({ where: eq(users.id, buyerId) });
  const snapshot: Snapshot = {
    title: listing.title, price: listing.price, conditionGrade: listing.conditionGrade, description: listing.description,
    components: comps.map((c) => c.name), photo, brand: model?.brand ?? null, modelName: model?.modelName ?? null, modelId: listing.modelId,
    category: category?.name ?? null, conditionNote: terms?.conditionNote ?? null,
  };
  const shippingFee = terms?.shippingOneWay ?? account.defaultShipping;
  const trialFee = tiers && hours ? tiers.find((t) => t.hours === hours)!.fee : null;

  return db.transaction((tx) => {
    const reserved = tx.update(listings).set({ status: "RESERVED" }).where(and(eq(listings.id, listing.id), eq(listings.status, "ACTIVE"))).run();
    if (reserved.changes !== 1) throw new TradeError("다른 분과 거래 중인 상품이에요.", 409);
    const row = tx.insert(orders).values({
      listingId: listing.id, buyerId, sellerId: listing.sellerId, kind: input.kind, status: "AWAIT_PAYMENT",
      snapshot: JSON.stringify(snapshot), price: listing.price, shippingFee, tiers: tiers ? JSON.stringify(tiers) : null,
      trialHours: hours, trialFee, proposalId, questions: JSON.stringify(questions),
      depositName: depositNameFor(buyer?.nickname ?? null, randomInt(10000)), shipEnc: seal(ship),
      sellerAccountEnc: seal({ bank: account.bank, account: open<string>(account.accountEnc) ?? "", holder: account.holder }),
    }).returning().get();
    eventTx(tx, row.id, buyerId, "CREATED", { kind: input.kind, hours, trialFee, price: listing.price, shippingFee });
    systemMessageTx(tx, row, input.kind === "TRIAL"
      ? `${hours}시간 써보기 신청이 들어왔어요. 구매자가 ${(listing.price + shippingFee).toLocaleString("ko-KR")}원을 판매자 계좌로 보내면, 판매자가 입금을 확인해 주세요.`
      : `구매 신청이 들어왔어요. 구매자가 ${(listing.price + shippingFee).toLocaleString("ko-KR")}원을 판매자 계좌로 보내면, 판매자가 입금을 확인해 주세요.`);
    return row;
  });
}

// ── 행동 ──

// param: orderId, userId, action, body 입력값. return: 바뀐 거래. 예외: TradeError
export async function act(orderId: string, userId: string, action: Action | "SET_REFUND_ACCOUNT", body: Record<string, unknown>): Promise<OrderRow> {
  await advanceOrders([orderId]);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) throw new TradeError("거래를 찾을 수 없습니다.", 404);
  const role: Role | null = o.buyerId === userId ? "buyer" : o.sellerId === userId ? "seller" : null;
  if (!role) throw new TradeError("거래를 찾을 수 없습니다.", 404);
  const dispute = disputeOpen(o.id);
  const status = o.status as OrderStatus;
  const settings = await loadTradeSettings();

  if (action === "SET_REFUND_ACCOUNT") {
    if (role !== "buyer" || !["REFUND_DUE", "RETURN_REQUESTED", "RETURN_SHIPPED"].includes(status)) throw new TradeError("지금은 환불 계좌를 바꿀 수 없어요.", 409);
    const acc = parseBankAccount(body.refundAccount);
    if (typeof acc === "string") throw new TradeError(acc);
    return db.transaction((tx) => {
      const r = moveTx(tx, o.id, status, { refundEnc: seal(acc) });
      if (!r) throw new TradeError("상태가 바뀌었어요. 새로고침해 주세요.", 409);
      eventTx(tx, o.id, userId, "REFUND_ACCOUNT_SET");
      return r;
    });
  }

  if (!allowedActions(o.kind as OrderKind, status, role, dispute).includes(action)) {
    throw new TradeError(dispute ? "분쟁 확인 중이라 지금은 할 수 없어요. 운영자 확인을 기다려 주세요." : "지금 상태에서는 할 수 없는 일이에요. 새로고침해 주세요.", 409);
  }
  const t = now();
  const fail = () => { throw new TradeError("다른 요청이 먼저 처리됐어요. 새로고침해 주세요.", 409); };

  switch (action) {
    case "CONFIRM_PAYMENT":
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, "AWAIT_PAYMENT", { status: "PAID", paidAt: t }) ?? fail();
        eventTx(tx, o.id, userId, "PAYMENT_CONFIRMED");
        systemMessageTx(tx, r, `판매자가 입금을 확인했어요. ${settings.shipPromiseDays}일 안에 발송할 예정이에요.`);
        return r;
      });
    case "SHIP": {
      const bad = shipInputProblem(body.carrier, body.tracking);
      if (bad) throw new TradeError(bad);
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, "PAID", { status: "SHIPPED", shippedAt: t, shipCarrier: body.carrier as string, shipTracking: (body.tracking as string).trim() }) ?? fail();
        eventTx(tx, o.id, userId, "SHIPPED", { carrier: body.carrier });
        systemMessageTx(tx, r, `판매자가 발송했어요(${body.carrier}). 받으면 '받았어요'를 눌러 주세요. ${o.kind === "TRIAL" ? "그때부터 써보기 시간이 시작돼요." : ""}`.trim());
        return r;
      });
    }
    case "RECEIVED":
      return db.transaction((tx) => receiveTx(tx, o, t, userId, settings) ?? fail());
    case "EXTEND": {
      const tiers: TrialTier[] = JSON.parse(o.tiers ?? "[]");
      const next = tiers.find((x) => x.hours === body.hours);
      if (!next || !o.trialHours || next.hours <= o.trialHours || !o.receivedAt) throw new TradeError("더 긴 기간 중에서 골라 주세요.");
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, "TRIAL", { trialHours: next.hours, trialFee: next.fee, trialEndAt: addHours(sqlToIso(o.trialEndAt!), next.hours - o.trialHours!) }, LOCK) ?? fail();
        eventTx(tx, o.id, userId, "EXTENDED", { from: o.trialHours, to: next.hours, fee: next.fee });
        systemMessageTx(tx, r, `구매자가 써보기를 ${next.hours}시간으로 늘렸어요. 돌려보내면 체험료는 ${next.fee.toLocaleString("ko-KR")}원이에요(추가 입금 없음).`);
        return r;
      });
    }
    case "PURCHASE": {
      const pct = await feePctNow();
      return db.transaction((tx) => purchaseTx(tx, o, ["TRIAL", "NEEDS_CHECK", "RECEIVED"], userId, pct, settings, "구매자가 구매를 확정했어요.") ?? fail());
    }
    case "RETURN": {
      const reason = RETURN_REASONS.find((r) => r.key === body.reason);
      if (!reason) throw new TradeError("반납 이유를 골라 주세요.");
      const note = typeof body.note === "string" ? body.note.trim() : "";
      if (note.length > 200) throw new TradeError("메모는 200자 이하로 적어 주세요.");
      if (findContactInfo(note)) throw new TradeError("메모에는 연락처·계좌를 적을 수 없어요.");
      const acc = parseBankAccount(body.refundAccount);
      if (typeof acc === "string") throw new TradeError(`환불 받을 계좌: ${acc}`);
      const tiers: TrialTier[] = JSON.parse(o.tiers ?? "[]");
      const used = hoursBetween(sqlToIso(o.receivedAt!), t) - o.trialPausedMs / 3600_000; // 분쟁으로 멈춘 시간은 빼고 센다
      const fee = returnFeeFor(tiers, o.trialHours!, used);
      const refund = Math.max(0, o.price - fee);
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, ["TRIAL", "NEEDS_CHECK"], {
          status: "RETURN_REQUESTED", decidedAt: t, returnRequestedAt: t, returnReason: reason.key, returnNote: note || null,
          trialFee: fee, refundAmount: refund, refundKind: "RETURN", refundEnc: seal(acc),
        }, LOCK) ?? fail();
        eventTx(tx, o.id, userId, "RETURN_REQUESTED", { reason: reason.key, usedHours: Math.round(used), trialFee: fee, refund });
        systemMessageTx(tx, r, `구매자가 반납을 신청했어요(${reason.label}). ${settings.returnShipDays}일 안에 반송할 예정이에요. 환불 예정액은 ${refund.toLocaleString("ko-KR")}원(상품가 − 체험료 ${fee.toLocaleString("ko-KR")}원)이에요.`);
        return r;
      });
    }
    case "RETURN_SHIPPED": {
      const bad = shipInputProblem(body.carrier, body.tracking);
      if (bad) throw new TradeError(bad);
      const day = typeof body.handoverDate === "string" ? body.handoverDate : "";
      // 날짜는 한국 날짜로 비교한다(화면 기본값도 한국 날짜)
      const today = kstDateOf(t);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || day < kstDateOf(o.returnRequestedAt ?? t)) throw new TradeError("택배를 맡긴 날짜를 확인해 주세요(반납 신청일~오늘).");
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, "RETURN_REQUESTED", { status: "RETURN_SHIPPED", returnShippedAt: t, returnCarrier: body.carrier as string, returnTracking: (body.tracking as string).trim(), returnHandoverAt: day }) ?? fail();
        eventTx(tx, o.id, userId, "RETURN_SHIPPED", { carrier: body.carrier, handoverDate: day });
        systemMessageTx(tx, r, `구매자가 반송했어요(${body.carrier}, 맡긴 날 ${day}). 받으면 구성품을 확인하고 검수를 마쳐 주세요.`);
        return r;
      });
    }
    case "INSPECT": {
      const snap: Snapshot = JSON.parse(o.snapshot);
      const checks = (body.components ?? {}) as Record<string, unknown>;
      const items = snap.components.map((name) => ({ name, returned: checks[name] === true }));
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
      if (findContactInfo(note)) throw new TradeError("메모에는 연락처·계좌를 적을 수 없어요.");
      const missing = items.filter((x) => !x.returned).map((x) => x.name);
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, "RETURN_SHIPPED", { status: "REFUND_DUE", inspectedAt: t, inspection: JSON.stringify({ items, note }) }, LOCK) ?? fail();
        eventTx(tx, o.id, userId, "INSPECTED", { missing });
        systemMessageTx(tx, r, missing.length
          ? `판매자가 검수를 마쳤어요. 빠진 구성품: ${missing.join(", ")}. 환불 예정액 ${(o.refundAmount ?? 0).toLocaleString("ko-KR")}원은 그대로이고, 다툼이 있으면 분쟁을 신청할 수 있어요.`
          : `판매자가 검수를 마쳤어요. 구성품이 모두 돌아왔어요. ${settings.refundDays}일 안에 ${(o.refundAmount ?? 0).toLocaleString("ko-KR")}원을 환불할 예정이에요.`);
        return r;
      });
    }
    case "REFUND_SENT":
      if (!o.refundEnc) throw new TradeError("구매자가 환불 계좌를 아직 입력하지 않았어요. 채팅으로 알려 주세요.", 409);
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, "REFUND_DUE", { status: "REFUND_SENT", refundSentAt: t }, LOCK) ?? fail();
        eventTx(tx, o.id, userId, "REFUND_SENT", { amount: o.refundAmount });
        systemMessageTx(tx, r, `판매자가 ${(o.refundAmount ?? 0).toLocaleString("ko-KR")}원을 환불했다고 알렸어요. 통장에서 확인되면 '환불 받았어요'를 눌러 주세요.`);
        return r;
      });
    case "REFUND_RECEIVED":
      return db.transaction((tx) => {
        const done: OrderStatus = o.refundKind === "CANCEL" ? "CANCELLED" : "RETURNED";
        const r = moveTx(tx, o.id, "REFUND_SENT", { status: done, completedAt: t }, LOCK) ?? fail();
        eventTx(tx, o.id, userId, "REFUND_RECEIVED", { amount: o.refundAmount });
        if (done === "RETURNED") awardXpTx(tx, r);
        releaseListingTx(tx, o.listingId);
        systemMessageTx(tx, r, done === "RETURNED" ? "구매자가 환불을 확인했어요. 반납이 완료됐어요. 서로 후기를 남겨 주세요." : "구매자가 환불을 확인했어요. 거래가 취소됐어요.");
        return r;
      });
    case "CANCEL": {
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 100) : "";
      if (findContactInfo(reason)) throw new TradeError("취소 이유에는 연락처·계좌를 적을 수 없어요.");
      if (status === "AWAIT_PAYMENT") {
        return db.transaction((tx) => {
          const r = moveTx(tx, o.id, "AWAIT_PAYMENT", { status: "CANCELLED", cancelReason: reason || (role === "buyer" ? "구매자 취소" : "판매자 취소"), completedAt: t }, LOCK) ?? fail();
          eventTx(tx, o.id, userId, "CANCELLED", { by: role, reason });
          releaseListingTx(tx, o.listingId);
          systemMessageTx(tx, r, `${role === "buyer" ? "구매자" : "판매자"}가 입금 전에 거래를 취소했어요.`);
          return r;
        });
      }
      // 입금 뒤 발송 전 취소: 판매자가 전액(상품가 + 발송비)을 돌려준다.
      let refundEnc: string | null = o.refundEnc;
      if (role === "buyer") {
        const acc = parseBankAccount(body.refundAccount);
        if (typeof acc === "string") throw new TradeError(`환불 받을 계좌: ${acc}`);
        refundEnc = seal(acc);
      }
      const amount = o.price + o.shippingFee;
      return db.transaction((tx) => {
        const r = moveTx(tx, o.id, "PAID", { status: "REFUND_DUE", refundKind: "CANCEL", refundAmount: amount, refundEnc, cancelReason: reason || (role === "buyer" ? "구매자 취소" : "판매자 취소"), decidedAt: t }, LOCK) ?? fail();
        eventTx(tx, o.id, userId, "CANCEL_AFTER_PAYMENT", { by: role, amount });
        systemMessageTx(tx, r, `${role === "buyer" ? "구매자" : "판매자"}가 발송 전에 거래를 취소했어요. 판매자가 ${amount.toLocaleString("ko-KR")}원 전액을 돌려줘야 해요.${refundEnc ? "" : " 구매자는 거래 화면에서 환불 받을 계좌를 입력해 주세요."}`);
        return r;
      });
    }
  }
  throw new TradeError("요청 형식이 올바르지 않습니다.");
}

// 받음 처리(직접 또는 자동). TRIAL이면 그때부터 체험 시간이 시작된다.
function receiveTx(tx: Tx, o: OrderRow, at: string, actorId: string | null, settings: TradeSettings): OrderRow | null {
  const set: Partial<OrderRow> = o.kind === "TRIAL"
    ? { status: "TRIAL", receivedAt: at, trialEndAt: addHours(at, o.trialHours!) }
    : { status: "RECEIVED", receivedAt: at };
  const r = moveTx(tx, o.id, "SHIPPED", set, { blockIfDispute: !actorId });
  if (!r) return null;
  eventTx(tx, o.id, actorId, actorId ? "RECEIVED" : "AUTO_RECEIVED");
  systemMessageTx(tx, r, o.kind === "TRIAL"
    ? `${actorId ? "구매자가 물건을 받았어요" : `발송 뒤 ${settings.autoReceiveDays}일이 지나 받은 것으로 처리했어요`}. 지금부터 ${o.trialHours}시간 써볼 수 있어요. 마음에 들면 '살게요', 아니면 '돌려보낼게요'를 눌러 주세요.`
    : `${actorId ? "구매자가 물건을 받았어요" : `발송 뒤 ${settings.autoReceiveDays}일이 지나 받은 것으로 처리했어요`}. 확인 뒤 '구매 확정'을 눌러 주세요. ${settings.buyAutoConfirmDays}일 뒤에는 자동으로 구매 확정돼요.`);
  return r;
}

// 구매 확정(직접 또는 자동). 체험료 0원, 같은 상품대금을 다시 받지 않는다. 수수료는 기록만(정식 운영 때 판매자 청구).
function purchaseTx(tx: Tx, o: OrderRow, from: OrderStatus[], actorId: string | null, feePct: number, settings: TradeSettings, text: string): OrderRow | null {
  const fees = purchaseFees(o.price, feePct, settings.formalFeePct);
  const t = now();
  const r = moveTx(tx, o.id, from, { status: "PURCHASED", decidedAt: o.decidedAt ?? t, completedAt: t, feePct, feeAmount: fees.feeAmount, virtualFee: fees.virtualFee, trialFee: o.kind === "TRIAL" ? 0 : o.trialFee, refundAmount: null, refundKind: null }, LOCK);
  if (!r) return null;
  eventTx(tx, o.id, actorId, actorId ? "PURCHASED" : "AUTO_PURCHASED", { feePct, ...fees });
  awardXpTx(tx, r);
  tx.update(listings).set({ status: "SOLD" }).where(eq(listings.id, o.listingId)).run();
  systemMessageTx(tx, r, `${text} 체험료는 0원이고 추가로 낼 돈은 없어요. 서로 후기를 남겨 주세요.`);
  return r;
}

// ── 자동 처리(읽을 때마다 정리) ──

// param: ids 대상 거래(없으면 끝나지 않은 전체). 기한이 지난 거래를 정해진 규칙대로 옮기고, 늦어진 일은 운영 확인으로 표시한다.
export async function advanceOrders(ids?: string[]): Promise<void> {
  const settings = await loadTradeSettings();
  const pct = await feePctNow();
  const rows = await db.select().from(orders).where(and(notInArray(orders.status, FINAL_STATUSES), ids ? inArray(orders.id, ids) : undefined));
  const t = Date.now();
  const past = (iso: string | null, hours: number, shiftMs = 0) => Boolean(iso) && new Date(sqlToIso(iso!)).getTime() + hours * 3600_000 + shiftMs <= t;
  for (let o of rows) {
    if (disputeOpen(o.id)) continue; // 분쟁 중에는 자동 처리를 멈춘다
    for (let guard = 0; guard < 5; guard++) {
      const s = o.status as OrderStatus;
      let next: OrderRow | null = null;
      if (s === "AWAIT_PAYMENT" && past(o.createdAt, settings.paymentWaitHours)) {
        next = db.transaction((tx) => {
          const r = moveTx(tx, o.id, "AWAIT_PAYMENT", { status: "CANCELLED", cancelReason: "입금 기한 지남", completedAt: now() }, LOCK);
          if (r) { eventTx(tx, o.id, null, "AUTO_CANCELLED"); releaseListingTx(tx, o.listingId); systemMessageTx(tx, r, `${settings.paymentWaitHours}시간 안에 입금 확인이 되지 않아 거래가 자동 취소됐어요.`); }
          return r;
        });
      } else if (s === "SHIPPED" && past(o.shippedAt, settings.autoReceiveDays * 24, o.waitShiftMs)) {
        const at = addHours(sqlToIso(o.shippedAt!), settings.autoReceiveDays * 24 + o.waitShiftMs / 3600_000);
        next = db.transaction((tx) => receiveTx(tx, o, at, null, settings));
      } else if (s === "RECEIVED" && past(o.receivedAt, settings.buyAutoConfirmDays * 24, o.waitShiftMs)) {
        next = db.transaction((tx) => purchaseTx(tx, o, ["RECEIVED"], null, pct, settings, `받은 뒤 ${settings.buyAutoConfirmDays}일이 지나 자동으로 구매 확정됐어요.`));
      } else if (s === "TRIAL" && past(o.trialEndAt, 0)) {
        next = db.transaction((tx) => {
          const r = moveTx(tx, o.id, "TRIAL", { status: "NEEDS_CHECK", needsCheckAt: o.trialEndAt }, LOCK);
          if (r) { eventTx(tx, o.id, null, "NEEDS_CHECK"); systemMessageTx(tx, r, `써보기 시간이 끝났어요. ${settings.decisionGraceHours}시간 안에 '살게요' 또는 '돌려보낼게요'를 골라 주세요. 그때까지 답이 없으면 신청할 때 안내한 대로 구매로 확정돼요.`); }
          return r;
        });
      } else if (s === "NEEDS_CHECK" && past(o.trialEndAt, settings.decisionGraceHours)) {
        next = db.transaction((tx) => purchaseTx(tx, o, ["NEEDS_CHECK"], null, pct, settings, `써보기가 끝난 뒤 ${settings.decisionGraceHours}시간 동안 답이 없어 구매로 확정됐어요.`));
      }
      if (!next) break;
      o = next;
    }
    // 늦어진 일: 상태는 그대로 두고 운영 확인으로 표시
    const s = o.status as OrderStatus;
    const flag =
      s === "PAID" && past(o.paidAt, settings.shipPromiseDays * 24, o.waitShiftMs) ? "발송 약속 지남" :
      s === "RETURN_REQUESTED" && past(o.returnRequestedAt, settings.returnShipDays * 24, o.waitShiftMs) ? "반송 약속 지남" :
      s === "RETURN_SHIPPED" && past(o.returnHandoverAt ? `${o.returnHandoverAt}T00:00:00+09:00` : null, settings.inspectDays * 24, o.waitShiftMs) ? "검수 기한 지남" :
      s === "REFUND_DUE" && past(o.inspectedAt ?? o.decidedAt, settings.refundDays * 24, o.waitShiftMs) ? "환불 기한 지남" :
      s === "REFUND_SENT" && past(o.refundSentAt, 3 * 24, o.waitShiftMs) ? "환불 확인 대기" : null;
    if (flag !== o.opsFlag) db.update(orders).set({ opsFlag: flag }).where(eq(orders.id, o.id)).run();
  }
}

// ── 읽기 ──

export type OrderView = Awaited<ReturnType<typeof orderView>>;

// param: orderId, userId. return: 역할에 맞게 보이는 거래 정보, 참여자가 아니면 null
export async function orderView(orderId: string, userId: string, asAdmin = false) {
  await advanceOrders([orderId]);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) return null;
  const role: Role | null = o.buyerId === userId ? "buyer" : o.sellerId === userId ? "seller" : null;
  if (!role && !asAdmin) return null;
  const settings = await loadTradeSettings();
  const status = o.status as OrderStatus;
  const snap: Snapshot = JSON.parse(o.snapshot);
  const dispute = await db.query.disputes.findFirst({ where: eq(disputes.orderId, o.id), orderBy: desc(disputes.createdAt) });
  const open_ = dispute?.status === "OPEN";
  const account = await db.query.sellerAccounts.findFirst({ where: eq(sellerAccounts.userId, o.sellerId) });
  const snapAcc = open<BankTo>(o.sellerAccountEnc);
  const acc = snapAcc ?? (account ? { bank: account.bank, holder: account.holder, account: open<string>(account.accountEnc) ?? "" } : null);
  const ship = open<ShipTo>(o.shipEnc);
  const refundTo = open<BankTo>(o.refundEnc);
  const buyer = await db.query.users.findFirst({ where: eq(users.id, o.buyerId) });
  const seller = await db.query.users.findFirst({ where: eq(users.id, o.sellerId) });
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id)).orderBy(orderEvents.createdAt);
  const thread = await db.query.chatThreads.findFirst({ where: and(eq(chatThreads.listingId, o.listingId), eq(chatThreads.buyerId, o.buyerId)) });
  const after = (iso: string | null, h: number) => (iso ? addHours(sqlToIso(iso), h) : null);
  const showShip = role === "buyer" || asAdmin || (role === "seller" && !["AWAIT_PAYMENT", "CANCELLED"].includes(status) && Boolean(o.paidAt));
  const showRefund = role === "buyer" || asAdmin || (role === "seller" && ["REFUND_DUE", "REFUND_SENT"].includes(status));
  return {
    id: o.id, kind: o.kind as OrderKind, status, statusLabel: STATUS_LABEL[status], role, listingId: o.listingId, snapshot: snap,
    price: o.price, shippingFee: o.shippingFee, trialHours: o.trialHours, trialFee: o.trialFee, tiers: o.tiers ? (JSON.parse(o.tiers) as TrialTier[]) : null,
    questions: o.questions ? (JSON.parse(o.questions) as string[]) : [], money: moneyOf(o.price, o.shippingFee, o.kind === "TRIAL" ? o.trialFee : null),
    depositName: o.depositName, refundAmount: o.refundAmount, refundKind: o.refundKind, feeAmount: o.feeAmount, virtualFee: o.virtualFee, feePct: o.feePct,
    buyerName: buyer?.nickname ?? "구매자", sellerName: seller?.nickname ?? "판매자", sellerId: o.sellerId, buyerId: o.buyerId,
    // 판매자 계좌: 구매자가 돈을 보낼 때(입금 대기)만 전체 번호, 그 밖에는 가린다
    sellerAccount: acc ? { ...acc, account: role === "buyer" && status === "AWAIT_PAYMENT" ? acc.account : acc.account.replace(/^(\d{4})\d+(\d{4})$/, (_, a, b) => `${a}****${b}`) } : null,
    shipTo: showShip ? ship : null,
    refundTo: showRefund ? refundTo : null,
    shipCarrier: o.shipCarrier, shipTracking: o.shipTracking, returnReason: o.returnReason, returnNote: o.returnNote,
    returnCarrier: o.returnCarrier, returnTracking: o.returnTracking, returnHandoverAt: o.returnHandoverAt,
    inspection: o.inspection ? (JSON.parse(o.inspection) as { items: { name: string; returned: boolean }[]; note: string }) : null,
    cancelReason: o.cancelReason, opsFlag: o.opsFlag,
    times: { createdAt: o.createdAt, paidAt: o.paidAt, shippedAt: o.shippedAt, receivedAt: o.receivedAt, trialEndAt: o.trialEndAt, completedAt: o.completedAt, refundSentAt: o.refundSentAt },
    deadlines: {
      payBy: status === "AWAIT_PAYMENT" ? after(o.createdAt, settings.paymentWaitHours) : null,
      shipBy: status === "PAID" ? after(o.paidAt, settings.shipPromiseDays * 24) : null,
      trialEnd: ["TRIAL", "NEEDS_CHECK"].includes(status) ? o.trialEndAt : null,
      decideBy: ["TRIAL", "NEEDS_CHECK"].includes(status) ? after(o.trialEndAt, settings.decisionGraceHours) : null,
      returnShipBy: status === "RETURN_REQUESTED" ? after(o.returnRequestedAt, settings.returnShipDays * 24) : null,
      autoConfirmAt: status === "RECEIVED" ? after(o.receivedAt, settings.buyAutoConfirmDays * 24) : null,
      autoReceiveAt: status === "SHIPPED" ? after(o.shippedAt, settings.autoReceiveDays * 24) : null,
    },
    actions: role ? allowedActions(o.kind as OrderKind, status, role, open_) : [],
    dispute: dispute ? { id: dispute.id, status: dispute.status, reason: dispute.reason, detail: dispute.detail, resolution: dispute.resolution, mine: dispute.openerId === userId } : null,
    events: events.map((e) => ({ type: e.type, at: e.createdAt, by: e.actorId === o.buyerId ? "buyer" : e.actorId === o.sellerId ? "seller" : e.actorId ? "admin" : "system", data: e.data ? JSON.parse(e.data) : null })),
    threadId: thread?.id ?? null,
    final: isFinal(status),
  };
}

// param: userId, side buyer/seller/all. return: 내 거래 목록(최근 순)
export async function listOrders(userId: string, side: "buyer" | "seller" | "all" = "all") {
  const mine = side === "buyer" ? eq(orders.buyerId, userId) : side === "seller" ? eq(orders.sellerId, userId) : or(eq(orders.buyerId, userId), eq(orders.sellerId, userId));
  const ids = (await db.select({ id: orders.id }).from(orders).where(and(mine, notInArray(orders.status, FINAL_STATUSES)))).map((r) => r.id);
  if (ids.length) await advanceOrders(ids);
  const rows = await db.select().from(orders).where(mine).orderBy(desc(sql`datetime(${orders.updatedAt})`)).limit(100);
  return rows.map((o) => {
    const snap: Snapshot = JSON.parse(o.snapshot);
    return {
      id: o.id, kind: o.kind as OrderKind, status: o.status as OrderStatus, statusLabel: STATUS_LABEL[o.status as OrderStatus], role: (o.buyerId === userId ? "buyer" : "seller") as Role,
      title: snap.title, photo: snap.photo, modelName: snap.modelName, category: snap.category, price: o.price, trialHours: o.trialHours, updatedAt: o.updatedAt, opsFlag: o.opsFlag,
      needsMe: allowedActions(o.kind as OrderKind, o.status as OrderStatus, o.buyerId === userId ? "buyer" : "seller", false).some((a) => a !== "CANCEL" && a !== "EXTEND"),
    };
  });
}

// param: listingId. return: 이 상품의 진행 중 거래(없으면 null)
export async function activeOrderOf(listingId: string) {
  await advanceListing(listingId);
  return db.query.orders.findFirst({ where: and(eq(orders.listingId, listingId), notInArray(orders.status, FINAL_STATUSES)) }) ?? null;
}

// ── 분쟁 ──
export const DISPUTE_REASONS = ["설명과 달라요", "하자·고장", "구성품이 빠졌어요", "훼손돼서 돌아왔어요", "입금·환불 문제", "연락이 안 돼요", "기타"] as const;

// param: orderId, userId, reason, detail. return: 만든 분쟁. 같은 거래에 열린 분쟁은 하나만.
export async function openDispute(orderId: string, userId: string, reason: unknown, detail: unknown) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o || (o.buyerId !== userId && o.sellerId !== userId)) throw new TradeError("거래를 찾을 수 없습니다.", 404);
  if (o.status === "AWAIT_PAYMENT" || o.status === "CANCELLED") throw new TradeError("입금 전이거나 취소된 거래는 분쟁을 열 수 없어요. 채팅으로 이야기해 주세요.", 409);
  if (isFinal(o.status) && o.completedAt && hoursBetween(sqlToIso(o.completedAt), now()) > 7 * 24) throw new TradeError("거래가 끝나고 7일이 지나 분쟁을 열 수 없어요.", 409);
  if (!(DISPUTE_REASONS as readonly unknown[]).includes(reason)) throw new TradeError("분쟁 이유를 골라 주세요.");
  const text = typeof detail === "string" ? detail.trim() : "";
  if (text.length < 5 || text.length > 500) throw new TradeError("무슨 일인지 5~500자로 적어 주세요.");
  if (findContactInfo(text)) throw new TradeError("연락처·계좌는 적을 수 없어요.");
  const today = db.get<{ n: number }>(sql`select count(*) as n from disputes where opener_id = ${userId} and created_at > datetime('now','-1 day')`)?.n ?? 0;
  if (today >= DISPUTE_DAILY_MAX) throw new TradeError("오늘은 분쟁을 충분히 열었어요.", 429);
  return db.transaction((tx) => {
    const exists = tx.select({ id: disputes.id }).from(disputes).where(and(eq(disputes.orderId, orderId), eq(disputes.status, "OPEN"))).get();
    if (exists) throw new TradeError("이미 운영자가 확인 중인 분쟁이 있어요.", 409);
    const d = tx.insert(disputes).values({ orderId, openerId: userId, reason: reason as string, detail: text }).returning().get();
    eventTx(tx, orderId, userId, "DISPUTE_OPENED", { reason });
    systemMessageTx(tx, o, `${o.buyerId === userId ? "구매자" : "판매자"}가 분쟁을 신청했어요(${reason}). 운영자가 양쪽 이야기와 기록을 확인할 때까지 금액 확정·자동 처리를 멈춰요.`);
    return d;
  });
}

// 운영자: 분쟁 종료.
// param: outcome CONTINUE 그대로 진행 | REFUND 환불로 끝내기(취소, 금액 지정) | PURCHASE 구매로 확정
//        refundAmount CONTINUE면 반납 환불액 조정(환불 전 단계), REFUND면 돌려줄 금액(필수), buyerFault 구매자 책임 확인 여부
// 분쟁이 열려 있던 시간만큼 체험 끝·자동 처리 기한을 늦추고, 반납 체험료 계산에서도 뺀다.
export type DisputeOutcome = "CONTINUE" | "REFUND" | "PURCHASE";
export async function resolveDispute(disputeId: string, resolution: string, buyerFault: boolean, refundAmount?: number, outcome: DisputeOutcome = "CONTINUE") {
  const d = await db.query.disputes.findFirst({ where: eq(disputes.id, disputeId) });
  if (!d || d.status !== "OPEN") throw new TradeError("열린 분쟁을 찾을 수 없습니다.", 404);
  const o = await db.query.orders.findFirst({ where: eq(orders.id, d.orderId) });
  if (!o) throw new TradeError("거래를 찾을 수 없습니다.", 404);
  if (resolution.trim().length < 2 || resolution.length > 500) throw new TradeError("처리 결과를 2~500자로 적어 주세요.");
  const max = o.price + o.shippingFee;
  const amountOk = (v: number | undefined) => v !== undefined && Number.isInteger(v) && v >= 0 && v <= max;
  if (outcome === "CONTINUE" && refundAmount !== undefined && (!amountOk(refundAmount) || !["REFUND_DUE", "RETURN_SHIPPED", "RETURN_REQUESTED"].includes(o.status))) {
    throw new TradeError("환불액은 0원 이상, 최초 결제금 이하로, 환불 전 단계에서만 바꿀 수 있어요.");
  }
  if (outcome === "REFUND" && (!amountOk(refundAmount) || isFinal(o.status) || o.status === "AWAIT_PAYMENT" || o.status === "REFUND_SENT")) {
    throw new TradeError("환불로 끝내려면 0원~최초 결제금 사이 금액을 적어 주세요(끝났거나 환불을 보낸 거래는 안 돼요).");
  }
  if (outcome === "PURCHASE" && !["RECEIVED", "TRIAL", "NEEDS_CHECK", "RETURN_REQUESTED", "RETURN_SHIPPED", "REFUND_DUE"].includes(o.status)) {
    throw new TradeError("물건을 받은 뒤 단계에서만 구매로 확정할 수 있어요.");
  }
  const settings = await loadTradeSettings();
  const pct = await feePctNow();
  const pausedMs = Math.max(0, Date.now() - new Date(sqlToIso(d.createdAt)).getTime());
  db.transaction((tx) => {
    const done = tx.update(disputes).set({ status: "RESOLVED", resolution: resolution.trim(), buyerFault, resolvedAt: now() }).where(and(eq(disputes.id, d.id), eq(disputes.status, "OPEN"))).run();
    if (done.changes !== 1) throw new TradeError("이미 정리된 분쟁이에요.", 409); // 두 번 눌러도 한 번만
    // 멈춘 시간 반영: 체험 중이면 체험 끝을 늦추고 사용 시간에서 빼며, 그 밖에는 자동 처리 기한을 늦춘다
    const inTrial = o.status === "TRIAL" || o.status === "NEEDS_CHECK";
    tx.update(orders).set(inTrial && o.trialEndAt
      ? { trialEndAt: new Date(new Date(sqlToIso(o.trialEndAt)).getTime() + pausedMs).toISOString(), trialPausedMs: o.trialPausedMs + pausedMs, updatedAt: now() }
      : { waitShiftMs: o.waitShiftMs + pausedMs, updatedAt: now() }).where(eq(orders.id, o.id)).run();
    let text = `운영자가 분쟁을 정리했어요: ${resolution.trim()}`;
    if (outcome === "CONTINUE") {
      if (refundAmount !== undefined) tx.update(orders).set({ refundAmount, updatedAt: now() }).where(eq(orders.id, o.id)).run();
      text += refundAmount !== undefined ? ` (환불액 ${refundAmount.toLocaleString("ko-KR")}원)` : "";
      text += ". 거래를 이어서 진행해 주세요.";
    } else if (outcome === "REFUND") {
      const r = moveTx(tx, o.id, o.status as OrderStatus, { status: "REFUND_DUE", refundKind: "CANCEL", refundAmount: refundAmount!, decidedAt: now() });
      if (!r) throw new TradeError("상태가 바뀌었어요. 새로고침해 주세요.", 409);
      text += `. ${refundAmount!.toLocaleString("ko-KR")}원을 환불하고 거래를 끝내요. 판매자는 환불 뒤 '환불 보냈어요'를, 구매자는 받은 뒤 '환불 받았어요'를 눌러 주세요.${r.refundEnc ? "" : " 구매자는 환불 받을 계좌를 입력해 주세요."}`;
    } else {
      const fresh = tx.select().from(orders).where(eq(orders.id, o.id)).get()!;
      if (!purchaseTx(tx, fresh, [o.status as OrderStatus], null, pct, settings, "운영자 결정으로 구매로 확정했어요.")) throw new TradeError("상태가 바뀌었어요. 새로고침해 주세요.", 409);
      text += ".";
    }
    eventTx(tx, o.id, null, "DISPUTE_RESOLVED", { buyerFault, refundAmount, outcome, pausedHours: Math.round(pausedMs / 360_000) / 10 });
    systemMessageTx(tx, o, text);
  });
}
