// 거래 평가(구매자↔판매자 교차)와 써보니 후기(체험 거래 구매자만).
// - 거래 평가는 둘 다 쓰거나, 거래가 끝나고 reviewRevealDays가 지나면 공개한다(서로의 평가를 보고 보복하지 못하게).
// - 후기에는 보상을 주지 않는다. 경험치는 거래 완료로만 준다.
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orders, reviews, trialReviews, users } from "@/db/schema";
import { loadTradeSettings } from "@/lib/trade-settings-store";
import { TradeError, type Snapshot } from "@/lib/orders";
import { findContactInfo } from "@/ui/trial-pricing";
import { REVIEW_CHIPS, REVIEW_SAMPLES, hoursBetween, sqlToIso } from "@/ui/trade-rules";

const DONE = ["PURCHASED", "RETURNED"];

// param: o 거래, userId. return: 쓸 수 있는 평가 종류와 이미 쓴 것
export async function reviewState(orderId: string, userId: string) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o || (o.buyerId !== userId && o.sellerId !== userId)) return null;
  const s = await loadTradeSettings();
  const inWindow = DONE.includes(o.status) && Boolean(o.completedAt) && hoursBetween(sqlToIso(o.completedAt!), new Date().toISOString()) <= s.reviewWindowDays * 24;
  const mine = await db.query.reviews.findFirst({ where: and(eq(reviews.orderId, o.id), eq(reviews.writerId, userId)) });
  const theirs = await db.query.reviews.findFirst({ where: and(eq(reviews.orderId, o.id), eq(reviews.targetId, userId)) });
  const trial = await db.query.trialReviews.findFirst({ where: eq(trialReviews.orderId, o.id) });
  const revealed = Boolean(mine && theirs) || (Boolean(o.completedAt) && hoursBetween(sqlToIso(o.completedAt!), new Date().toISOString()) >= s.reviewRevealDays * 24);
  const isBuyer = o.buyerId === userId;
  return {
    direction: (isBuyer ? "B2S" : "S2B") as "B2S" | "S2B",
    canReview: inWindow && !mine,
    canTrialReview: isBuyer && o.kind === "TRIAL" && Boolean(o.receivedAt) && inWindow && !trial,
    mine: mine ?? null,
    theirs: theirs && revealed ? theirs : null,
    theirsWaiting: Boolean(theirs) && !revealed,
    trial: trial ?? null,
    questions: o.questions ? (JSON.parse(o.questions) as string[]) : [],
  };
}

const clean = (v: unknown, max: number, label: string): string | null => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") throw new TradeError(`${label} 형식이 올바르지 않습니다.`);
  const t = v.trim();
  if (t.length > max) throw new TradeError(`${label}은 ${max}자 이하로 적어 주세요.`);
  if (findContactInfo(t)) throw new TradeError(`${label}에는 연락처·계좌를 적을 수 없어요.`);
  return t || null;
};

// param: orderId, userId, body {stars, chips, sample?, body?, descMatch?, compMatch?}. 별점·문구는 필수
export async function writeReview(orderId: string, userId: string, body: Record<string, unknown>) {
  const st = await reviewState(orderId, userId);
  if (!st) throw new TradeError("거래를 찾을 수 없습니다.", 404);
  if (!st.canReview) throw new TradeError(st.mine ? "이미 평가를 남겼어요." : "거래가 끝난 뒤 정해진 기간 안에만 평가할 수 있어요.", 409);
  const stars = body.stars;
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 10) throw new TradeError("별점을 1~10 중에서 골라 주세요.");
  const allowed: readonly string[] = [...REVIEW_CHIPS[st.direction].good, ...REVIEW_CHIPS[st.direction].bad];
  const chips = Array.isArray(body.chips) ? [...new Set(body.chips.filter((c): c is string => typeof c === "string" && allowed.includes(c)))] : [];
  if (chips.length === 0) throw new TradeError("어떤 점이 좋았는지(아쉬웠는지) 하나 이상 골라 주세요.");
  const sample = body.sample === undefined || body.sample === null || body.sample === "" ? null : (REVIEW_SAMPLES[st.direction] as readonly unknown[]).includes(body.sample) ? (body.sample as string) : null;
  const text = clean(body.body, 300, "후기");
  let descMatch: boolean | null = null;
  let compMatch: boolean | null = null;
  if (st.direction === "B2S") {
    if (typeof body.descMatch !== "boolean" || typeof body.compMatch !== "boolean") throw new TradeError("설명·구성품이 맞았는지 골라 주세요.");
    descMatch = body.descMatch; compMatch = body.compMatch;
  }
  const o = (await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))!;
  const targetId = st.direction === "B2S" ? o.sellerId : o.buyerId;
  db.insert(reviews).values({ orderId, writerId: userId, targetId, direction: st.direction, stars, chips: JSON.stringify(chips), sample, body: text, descMatch, compMatch })
    .onConflictDoNothing().run();
}

// param: orderId, userId, body {answers:[{q,a}], reason, learned, fitFor}. 체험 거래 구매자만, 한 번만
export async function writeTrialReview(orderId: string, userId: string, body: Record<string, unknown>) {
  const st = await reviewState(orderId, userId);
  if (!st) throw new TradeError("거래를 찾을 수 없습니다.", 404);
  if (!st.canTrialReview) throw new TradeError(st.trial ? "이미 써보니 후기를 남겼어요." : "써보기로 받은 뒤 끝난 거래만 써보니 후기를 쓸 수 있어요.", 409);
  const raw = Array.isArray(body.answers) ? body.answers : [];
  const answers: { q: string; a: string }[] = [];
  for (const x of raw) {
    const q = (x as Record<string, unknown>)?.q;
    if (typeof q !== "string" || !st.questions.includes(q)) continue;
    const a = clean((x as Record<string, unknown>).a, 100, `'${q}' 답`);
    if (a) answers.push({ q, a });
  }
  const reason = clean(body.reason, 100, "결정한 이유");
  const learned = clean(body.learned, 60, "써보고 알게 된 점");
  const fitFor = clean(body.fitFor, 60, "어울리는 사람");
  if (!learned && answers.length === 0) throw new TradeError("써보고 알게 된 점이나 궁금했던 점의 답을 하나 이상 적어 주세요.");
  const o = (await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))!;
  const snap: Snapshot = JSON.parse(o.snapshot);
  db.insert(trialReviews).values({
    orderId, writerId: userId, modelId: snap.modelId, outcome: o.status, hours: o.trialHours ?? 0,
    answers: JSON.stringify(answers), reason, learned, fitFor, conditionGrade: snap.conditionGrade,
  }).onConflictDoNothing().run();
}

// 공개된 평가 조건: 둘 다 썼거나, 거래가 끝나고 공개일이 지남
const REVEALED = (days: number) => sql`(exists (select 1 from reviews r2 where r2.order_id = ${reviews.orderId} and r2.writer_id = ${reviews.targetId})
  or (select datetime(o.completed_at) from orders o where o.id = ${reviews.orderId}) <= datetime('now', ${`-${days} days`}))`;

// param: userId 받은 사람, direction(B2S = 판매자로서 받은 평가). return: 공개된 평가 목록
export async function receivedReviews(userId: string, direction?: "B2S" | "S2B") {
  const s = await loadTradeSettings();
  const rows = await db.select({ r: reviews, writer: users.nickname, snapshot: orders.snapshot }).from(reviews)
    .innerJoin(users, eq(users.id, reviews.writerId)).innerJoin(orders, eq(orders.id, reviews.orderId))
    .where(and(eq(reviews.targetId, userId), direction ? eq(reviews.direction, direction) : undefined, REVEALED(s.reviewRevealDays)))
    .orderBy(desc(reviews.createdAt)).limit(100);
  return rows.map(({ r, writer, snapshot }) => ({ ...r, chips: JSON.parse(r.chips) as string[], writer: writer ?? "익명", title: (JSON.parse(snapshot) as Snapshot).title }));
}

// param: userId 쓴 사람. return: 내가 쓴 평가(공개 여부와 상관없이 본인에게는 보임)
export async function sentReviews(userId: string) {
  const rows = await db.select({ r: reviews, target: users.nickname, snapshot: orders.snapshot }).from(reviews)
    .innerJoin(users, eq(users.id, reviews.targetId)).innerJoin(orders, eq(orders.id, reviews.orderId))
    .where(eq(reviews.writerId, userId)).orderBy(desc(reviews.createdAt)).limit(100);
  return rows.map(({ r, target, snapshot }) => ({ ...r, chips: JSON.parse(r.chips) as string[], target: target ?? "익명", title: (JSON.parse(snapshot) as Snapshot).title }));
}

type TrialReviewRow = typeof trialReviews.$inferSelect;
const trialOut = (t: TrialReviewRow, writer: string | null, snapshot: string) => {
  const s: Snapshot = JSON.parse(snapshot);
  return { ...t, answers: t.answers ? (JSON.parse(t.answers) as { q: string; a: string }[]) : [], writer: writer ?? "익명", title: s.title, modelName: s.modelName, category: s.category };
};

// param: modelId. return: 같은 모델의 써보니 후기(최근 순)
export async function trialReviewsByModel(modelId: string, limit = 20) {
  const rows = await db.select({ t: trialReviews, writer: users.nickname, snapshot: orders.snapshot }).from(trialReviews)
    .innerJoin(users, eq(users.id, trialReviews.writerId)).innerJoin(orders, eq(orders.id, trialReviews.orderId))
    .where(eq(trialReviews.modelId, modelId)).orderBy(desc(trialReviews.createdAt)).limit(limit);
  return rows.map(({ t, writer, snapshot }) => trialOut(t, writer, snapshot));
}

// param: by 'writer' 내가 쓴 / 'seller' 내 상품에 달린. return: 써보니 후기
export async function trialReviewsOf(userId: string, by: "writer" | "seller") {
  const rows = await db.select({ t: trialReviews, writer: users.nickname, snapshot: orders.snapshot }).from(trialReviews)
    .innerJoin(users, eq(users.id, trialReviews.writerId)).innerJoin(orders, eq(orders.id, trialReviews.orderId))
    .where(by === "writer" ? eq(trialReviews.writerId, userId) : eq(orders.sellerId, userId)).orderBy(desc(trialReviews.createdAt)).limit(100);
  return rows.map(({ t, writer, snapshot }) => trialOut(t, writer, snapshot));
}

// param: userId. return: 사용자별 받은 공개 평가 평균 별점·건수(판매자로서 B2S, 구매자로서 S2B)
export async function starSummary(userId: string) {
  const s = await loadTradeSettings();
  const rows = await db.select({ direction: reviews.direction, avg: sql<number>`avg(${reviews.stars})`, n: sql<number>`count(*)` }).from(reviews)
    .where(and(eq(reviews.targetId, userId), REVEALED(s.reviewRevealDays))).groupBy(reviews.direction);
  const pick = (d: string) => { const r = rows.find((x) => x.direction === d); return r && r.n > 0 ? { avg: Math.round(r.avg * 10) / 10, count: r.n } : null; };
  return { asSeller: pick("B2S"), asBuyer: pick("S2B") };
}

