// 정기 작업: 서버가 켜져 있는 동안 1분마다 휴대폰 알림 발송, 10분마다 기한 지난 거래 자동 처리·기한 임박 알림·후기 요청·하루 묶음 알림.
// 같은 알림은 dedupeKey로 한 번만 만든다. 한 작업이 실패해도 다음 작업은 계속한다.
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings, orders, reviews } from "@/db/schema";
import { advanceOrders, disputeOpen } from "@/lib/orders";
import { notifyTx, sendPending } from "@/lib/notify";
import { loadTradeSettings } from "@/lib/trade-settings-store";
import { dailyRetainedBackup, purgeRetained } from "@/lib/retain";
import { cleanupOrphans, retainPending } from "@/lib/withdraw";
import { FINAL_STATUSES, sqlToIso, type OrderStatus } from "@/ui/trade-rules";

const H = 3600_000;
const ms = (iso: string | null | undefined) => (iso ? new Date(sqlToIso(iso)).getTime() : NaN);
const left = (deadline: number) => { const h = Math.ceil((deadline - Date.now()) / H); return h >= 24 ? `${Math.floor(h / 24)}일` : `${h}시간`; };

// 기한이 가까운 거래에 한 번씩 알린다. return: 만든 알림 수
export async function deadlineReminders(): Promise<number> {
  const s = await loadTradeSettings();
  const rows = db.select().from(orders).where(notInArray(orders.status, FINAL_STATUSES)).all();
  const titles = new Map(db.select({ id: listings.id, title: listings.title }).from(listings).where(inArray(listings.id, rows.length ? rows.map((r) => r.listingId) : [""])).all().map((r) => [r.id, r.title]));
  let made = 0;
  for (const o of rows) {
    if (disputeOpen(o.id)) continue; // 분쟁 중에는 기한이 멈춘다
    const st = o.status as OrderStatus;
    const shift = o.waitShiftMs;
    // [기한(ms), 미리 알릴 시간(시간), 받는 사람, 문구]
    const plan: [number, number, string, (l: string) => string] | null =
      st === "AWAIT_PAYMENT" ? [ms(o.createdAt) + s.paymentWaitHours * H, 12, o.buyerId, (l) => `입금 기한이 ${l} 남았어요. 판매자 계좌로 보내야 거래가 이어져요.`] :
      st === "PAID" ? [ms(o.paidAt) + s.shipPromiseDays * 24 * H + shift, 12, o.sellerId, (l) => `발송 약속 기한이 ${l} 남았어요. 보내고 송장을 입력해 주세요.`] :
      st === "SHIPPED" ? [ms(o.shippedAt) + s.autoReceiveDays * 24 * H + shift, 24, o.buyerId, (l) => `받으셨나요? ${l} 뒤에는 자동으로 받은 것으로 처리돼요.`] :
      st === "TRIAL" ? [ms(o.trialEndAt), (o.trialHours ?? 0) >= 48 ? 24 : 6, o.buyerId, (l) => `써보기가 ${l} 뒤 끝나요. 살지 돌려보낼지 생각해 두세요.`] :
      st === "NEEDS_CHECK" ? [ms(o.trialEndAt) + s.decisionGraceHours * H + shift, 12, o.buyerId, (l) => `${l} 안에 '살게요' 또는 '돌려보낼게요'를 고르지 않으면 구매로 확정돼요.`] :
      st === "RETURN_REQUESTED" ? [ms(o.returnRequestedAt) + s.returnShipDays * 24 * H + shift, 12, o.buyerId, (l) => `반송 약속 기한이 ${l} 남았어요. 보내고 송장을 입력해 주세요.`] :
      st === "RETURN_SHIPPED" ? [ms(o.returnHandoverAt ? `${o.returnHandoverAt}T00:00:00+09:00` : null) + s.inspectDays * 24 * H + shift, 24, o.sellerId, (l) => `검수 기한이 ${l} 남았어요. 받은 물건을 확인해 주세요.`] :
      st === "REFUND_DUE" ? [ms(o.inspectedAt ?? o.decidedAt) + s.refundDays * 24 * H + shift, 24, o.sellerId, (l) => `환불 기한이 ${l} 남았어요. 환불을 보내고 알려 주세요.`] :
      null;
    if (!plan || Number.isNaN(plan[0])) continue;
    const [deadline, aheadH, to, text] = plan;
    const remain = deadline - Date.now();
    if (remain <= 0 || remain > aheadH * H) continue;
    if (notifyTx(db, to, { category: "TRADE", title: `기한 알림 · ${titles.get(o.listingId) ?? "거래"}`, body: text(left(deadline)), url: `/orders/${o.id}`, dedupeKey: `remind:${st}:${o.id}` })) made++;
  }
  return made;
}

// 거래가 끝나고 3일이 지났는데 후기를 안 쓴 사람에게 한 번 알린다(후기 쓸 수 있는 기간 안에서만). return: 만든 알림 수
export async function reviewReminders(): Promise<number> {
  const s = await loadTradeSettings();
  const rows = db.select().from(orders).where(and(inArray(orders.status, ["PURCHASED", "RETURNED"]),
    sql`datetime(${orders.completedAt}) <= datetime('now', '-3 days')`, sql`datetime(${orders.completedAt}) > datetime('now', ${`-${s.reviewWindowDays} days`})`)).all();
  let made = 0;
  for (const o of rows) {
    for (const who of [o.buyerId, o.sellerId]) {
      const wrote = db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.orderId, o.id), eq(reviews.writerId, who))).get();
      if (wrote) continue;
      if (notifyTx(db, who, { category: "REVIEW", title: "거래 후기를 남겨 주세요", body: "후기는 서로 쓰거나 7일이 지나면 공개돼요. 다음 거래하는 분께 큰 도움이 돼요.", url: `/orders/${o.id}`, dedupeKey: `review:${o.id}` })) made++;
    }
  }
  return made;
}

// 하루 한 번(한국 시간 12시~13시): 지난 24시간 동안 내 상품에 생긴 찜·써보고 싶어요·사고 싶어요를 묶어 판매자에게. return: 만든 알림 수
export async function dailyDigest(now = Date.now()): Promise<number> {
  const k = new Date(now + 9 * H);
  if (k.getUTCHours() !== 12) return 0;
  const day = k.toISOString().slice(0, 10);
  const rows = db.all<{ sellerId: string; wish: number; tryWant: number; buyWant: number }>(sql`
    select l.seller_id as sellerId,
      count(distinct case when e.event_type = 'WISHLIST_ADD' then e.user_id || '|' || e.listing_id end) as wish,
      count(distinct case when e.event_type = 'CLICK_TRY_WANT' then e.user_id || '|' || e.listing_id end) as tryWant,
      count(distinct case when e.event_type = 'CLICK_BUY_WANT' then e.user_id || '|' || e.listing_id end) as buyWant
    from market_validation_events e join listings l on l.id = e.listing_id
    where e.created_at > datetime('now', '-1 day') and e.event_type in ('WISHLIST_ADD', 'CLICK_TRY_WANT', 'CLICK_BUY_WANT')
      and (e.user_id is null or e.user_id != l.seller_id) and l.status in ('ACTIVE', 'RESERVED')
    group by l.seller_id`);
  let made = 0;
  for (const r of rows) {
    const parts = [r.wish ? `찜 ${r.wish}` : "", r.tryWant ? `써보고 싶어요 ${r.tryWant}` : "", r.buyWant ? `사고 싶어요 ${r.buyWant}` : ""].filter(Boolean);
    if (parts.length === 0) continue;
    if (notifyTx(db, r.sellerId, { category: "INTEREST", title: "어제 내 상품 반응", body: `${parts.join(" · ")}. 관심이 많은 상품은 써보기 조건을 열어 보세요.`, url: "/me#my-listings", dedupeKey: `digest:${day}` })) made++;
  }
  return made;
}

// 10분마다 도는 일. 하나가 실패해도 다음은 한다. return: 단계별 결과
export async function runJobs(): Promise<Record<string, number | string>> {
  const out: Record<string, number | string> = {};
  const step = async (name: string, fn: () => Promise<number | void>) => {
    try { out[name] = (await fn()) ?? 0; } catch (e) { out[name] = `실패: ${(e as Error).message}`; console.error(`[jobs] ${name}`, e); }
  };
  await step("advance", () => advanceOrders());
  await step("remind", deadlineReminders);
  await step("review", reviewReminders);
  await step("digest", () => dailyDigest());
  await step("push", () => sendPending(200));
  // 탈퇴 2단계: WITHDRAW_ENABLED와 상관없이 돈다(이미 탈퇴한 사용자의 보관 이동·법정 파기, K8)
  await step("retain", async () => retainPending());
  await step("purge", async () => purgeRetained().done);
  // 보관 백업 세트: 마지막 세트가 24시간 넘었을 때만 하나 만든다(잠금 안, 파기 중 키는 뺀다)
  await step("retainBackup", async () => (dailyRetainedBackup() ? 1 : 0));
  await step("orphans", async () => cleanupOrphans());
  return out;
}

const g = globalThis as typeof globalThis & { __sseoboniJobs?: boolean };

// 서버 시작 때 한 번 건다(instrumentation.ts). 테스트·빌드에서 끄려면 JOBS_DISABLED=1
export function startJobs(): void {
  if (g.__sseoboniJobs || process.env.JOBS_DISABLED === "1") return;
  g.__sseoboniJobs = true;
  setTimeout(() => void runJobs(), 15_000);
  setInterval(() => void runJobs(), 10 * 60_000).unref?.();
  setInterval(() => void sendPending(), 60_000).unref?.();
}
