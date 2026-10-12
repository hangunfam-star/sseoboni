// 알림 만들기·휴대폰(웹 푸시) 보내기.
// - 알림은 사이트 안 알림함에 바로 보이고, 휴대폰 발송은 deliverAfter 이후 뒤에서 보낸다(발송 실패가 거래·채팅을 막지 않게).
// - 거래(TRADE) 알림은 끌 수 없고 밤 시간에도 바로 보낸다. 채팅·관심·후기는 설정으로 끌 수 있고, 밤 10시~아침 8시(한국 시간)에는 아침으로 미룬다.
// - 채팅은 같은 대화방의 안 읽은 알림이 5분 안에 있으면 새로 만들지 않고 내용만 바꾼다(휴대폰도 다시 울리지 않음).
import webpush from "web-push";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationPrefs, notifications, pushSubscriptions, wishlists } from "@/db/schema";
import { quietUntil } from "@/ui/notify-rules";

export type NotifyCategory = "TRADE" | "CHAT" | "INTEREST" | "REVIEW";
export type NotifyInput = { category: NotifyCategory; title: string; body: string; url: string; dedupeKey?: string };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Runner = Tx | typeof db;

// param: userId. return: 알림 설정(행이 없으면 모두 켬)
export function prefsOf(userId: string, run: Runner = db) {
  const p = run.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId)).get();
  return { chat: p?.chat ?? true, interest: p?.interest ?? true, review: p?.review ?? true, quiet: p?.quiet ?? true };
}

// param: tx 트랜잭션(또는 db), userId 받는 사람, n 알림 내용. return: 만들었으면 true(설정으로 끔·중복이면 false)
export function notifyTx(tx: Runner, userId: string, n: NotifyInput): boolean {
  const prefs = prefsOf(userId, tx);
  if ((n.category === "CHAT" && !prefs.chat) || (n.category === "INTEREST" && !prefs.interest) || (n.category === "REVIEW" && !prefs.review)) return false;
  const now = Date.now();
  if (n.category === "CHAT") {
    const recent = tx.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.url, n.url), isNull(notifications.readAt), gt(notifications.createdAt, sql`datetime('now', '-5 minutes')`))).get();
    if (recent) {
      tx.update(notifications).set({ body: n.body, title: n.title }).where(eq(notifications.id, recent.id)).run();
      return false;
    }
  }
  const deliverAfter = n.category !== "TRADE" && prefs.quiet ? quietUntil(now) : new Date(now).toISOString();
  const r = tx.insert(notifications).values({ userId, category: n.category, title: n.title.slice(0, 80), body: n.body.slice(0, 300), url: n.url, dedupeKey: n.dedupeKey ?? null, deliverAfter })
    .onConflictDoNothing().run();
  if (r.changes > 0) kickPush();
  return r.changes > 0;
}

// param: userId, url 이 주소로 가는 알림만(없으면 전부). 안 읽은 알림을 읽음으로
export function markNotificationsRead(userId: string, url?: string): number {
  return db.update(notifications).set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), url ? eq(notifications.url, url) : undefined)).run().changes;
}

// param: tx, listingId 상품, except 받지 않을 사람들, n 알림. 이 상품을 찜한 사람에게 알린다. return: 보낸 수
export function notifyWishersTx(tx: Runner, listingId: string, except: string[], n: NotifyInput): number {
  const users = tx.select({ userId: wishlists.userId }).from(wishlists).where(eq(wishlists.listingId, listingId)).all();
  let sent = 0;
  for (const u of users) if (!except.includes(u.userId) && notifyTx(tx, u.userId, n)) sent++;
  return sent;
}

// param: userId. return: 안 읽은 알림 수
export function unreadCount(userId: string): number {
  return db.get<{ n: number }>(sql`select count(*) as n from notifications where user_id = ${userId} and read_at is null`)?.n ?? 0;
}

// ── 웹 푸시 발송 ──

// return: VAPID 키가 있으면 공개키, 없으면 null(발송하지 않음)
export function vapidPublicKey(): string | null {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  return pub && priv ? pub : null;
}

const g = globalThis as typeof globalThis & { __sseoboniPushTimer?: ReturnType<typeof setTimeout> | null; __sseoboniPushRunning?: boolean };

// 곧 발송을 한 번 돌린다(여러 알림이 한꺼번에 생겨도 한 번만). 트랜잭션이 끝난 뒤 실행된다.
export function kickPush(): void {
  if (g.__sseoboniPushTimer) return;
  g.__sseoboniPushTimer = setTimeout(() => { g.__sseoboniPushTimer = null; void sendPending(); }, 200);
}

// param: sub 기기, payload 보낼 내용, urgent 거래 알림 여부. return: 기기 응답 상태 코드(전송 실패면 0)
async function pushTo(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, urgent: boolean): Promise<number> {
  const pub = vapidPublicKey();
  if (!pub) return 0;
  const req = webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
    vapidDetails: { subject: process.env.VAPID_SUBJECT?.trim() || "https://sseoboni.mwwork.co.kr", publicKey: pub, privateKey: process.env.VAPID_PRIVATE_KEY!.trim() },
    TTL: urgent ? 24 * 3600 : 12 * 3600, urgency: urgent ? "high" : "normal",
  });
  const res = await fetch(req.endpoint, { method: req.method, headers: req.headers as Record<string, string>, body: req.body ? new Uint8Array(req.body) : undefined, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  return res?.status ?? 0;
}

// 보낼 때가 된 알림을 휴대폰으로 보낸다. 한 번에 하나만 돈다. return: 처리한 알림 수
export async function sendPending(limit = 50): Promise<number> {
  if (g.__sseoboniPushRunning) return 0;
  g.__sseoboniPushRunning = true;
  try {
    const nowIso = new Date().toISOString();
    const due = db.select().from(notifications).where(and(isNull(notifications.pushedAt), lte(notifications.deliverAfter, nowIso))).limit(limit).all();
    for (const n of due) {
      // 먼저 처리 표시(다른 실행과 겹쳐도 한 번만 보냄)
      const claimed = db.update(notifications).set({ pushedAt: new Date().toISOString() }).where(and(eq(notifications.id, n.id), isNull(notifications.pushedAt))).run().changes === 1;
      if (!claimed || n.readAt) continue;
      const subs = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, n.userId)).all();
      const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.category === "CHAT" ? `chat:${n.url}` : n.id });
      for (const s of subs) {
        const status = await pushTo(s, payload, n.category === "TRADE");
        if (status >= 200 && status < 300) {
          db.update(pushSubscriptions).set({ failCount: 0, lastSuccessAt: new Date().toISOString() }).where(eq(pushSubscriptions.endpoint, s.endpoint)).run();
        } else if (status === 404 || status === 410 || s.failCount + 1 >= 5) {
          db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint)).run(); // 기기가 구독을 끊었거나 계속 실패
        } else {
          db.update(pushSubscriptions).set({ failCount: s.failCount + 1 }).where(eq(pushSubscriptions.endpoint, s.endpoint)).run();
        }
      }
    }
    return due.length;
  } finally {
    g.__sseoboniPushRunning = false;
  }
}
