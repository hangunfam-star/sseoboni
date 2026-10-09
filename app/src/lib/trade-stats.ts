// 거래 통계: 실거래 시세, 역할별 신뢰(확인된 사실·상대 평가 구분), 활동 등급, 판매자 분석.
// 모든 값은 실제 기록에서 센다. 기록이 없거나 적으면 숫자를 만들지 않고 "기록 없음"·"비교 거래 부족"으로 표시한다.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { xpAwards } from "@/db/schema";
import { loadTradeSettings } from "@/lib/trade-settings-store";
import { RETURN_REASONS, addHours, gradeOf, median, sqlToIso } from "@/ui/trade-rules";

const sinceExpr = (days: number) => `-${days} days`;

// param: modelId. return: 같은 모델의 실거래(구매 완료) 시세. 표본이 적으면 insufficient
export async function modelPrice(modelId: string) {
  const s = await loadTradeSettings();
  const rows = db.all<{ price: number }>(sql`select price from orders where status = 'PURCHASED'
    and json_extract(snapshot, '$.modelId') = ${modelId} and datetime(completed_at) >= datetime('now', ${sinceExpr(s.statsDays)})`);
  const prices = rows.map((r) => r.price);
  return {
    count: prices.length, days: s.statsDays, minCount: s.statsMinCount, insufficient: prices.length < s.statsMinCount,
    median: prices.length >= s.statsMinCount ? median(prices) : null,
    min: prices.length >= s.statsMinCount ? Math.min(...prices) : null,
    max: prices.length >= s.statsMinCount ? Math.max(...prices) : null,
    asOf: new Date().toISOString().slice(0, 10),
  };
}

// param: category. return: 등록된 써보기 조건 기준 하루 체험료 비율(체험료 ÷ 일수 ÷ 상품가)의 중앙값(%), 표본 수
export async function trialFeeRatio(category: string | null) {
  const s = await loadTradeSettings();
  if (!category) return null;
  const rows = db.all<{ price: number; tiers: string | null }>(sql`select l.price, t.tier_fees as tiers from listing_trial_terms t
    join listings l on l.id = t.listing_id join product_models m on m.id = l.model_id join categories c on c.id = m.category_id
    where l.status in ('ACTIVE','RESERVED') and c.name = ${category}`);
  const ratios: number[] = [];
  for (const r of rows) {
    try {
      for (const tier of JSON.parse(r.tiers ?? "[]") as { hours: number; fee: number }[]) ratios.push((tier.fee / Math.max(1, tier.hours / 24) / r.price) * 10000);
    } catch { /* 깨진 조건은 건너뜀 */ }
  }
  const listingsN = rows.length;
  if (listingsN < s.statsMinCount) return { category, listings: listingsN, insufficient: true, pct: null };
  const m = median(ratios.map((x) => Math.round(x)));
  return { category, listings: listingsN, insufficient: false, pct: m === null ? null : m / 100 };
}

// param: userId. return: 역할별 경험치·등급
export async function gradesOf(userId: string) {
  const s = await loadTradeSettings();
  const rows = await db.select({ role: xpAwards.role, n: sql<number>`count(*)` }).from(xpAwards).where(eq(xpAwards.userId, userId)).groupBy(xpAwards.role);
  const xp = (r: string) => rows.find((x) => x.role === r)?.n ?? 0;
  return { buyer: { xp: xp("BUYER"), ...gradeOf(xp("BUYER"), s.gradeSteps) }, seller: { xp: xp("SELLER"), ...gradeOf(xp("SELLER"), s.gradeSteps) } };
}

type Count = { done: number; total: number };

// param: userId 판매자. return: 확인된 사실(발송 약속)과 구매자 평가(설명·구성품 일치), 최근 statsDays일
export async function sellerTrust(userId: string) {
  const s = await loadTradeSettings();
  const since = sinceExpr(s.statsDays);
  const shipped = db.all<{ paid_at: string; shipped_at: string | null; status: string }>(sql`select paid_at, shipped_at, status from orders
    where seller_id = ${userId} and paid_at is not null and datetime(paid_at) >= datetime('now', ${since}) and (shipped_at is not null or status = 'PAID')`);
  const ship: Count = { done: 0, total: 0 };
  const nowMs = Date.now();
  for (const r of shipped) {
    const due = new Date(addHours(sqlToIso(r.paid_at), s.shipPromiseDays * 24)).getTime();
    if (r.shipped_at) { ship.total++; if (new Date(sqlToIso(r.shipped_at)).getTime() <= due) ship.done++; }
    else if (r.status === "PAID" && nowMs > due) ship.total++; // 아직 안 보냈는데 약속이 지남 → 실패(진행 중이고 기한 전이면 세지 않음)
  }
  const ev = db.get<{ dTotal: number; dYes: number; cTotal: number; cYes: number }>(sql`select
    sum(case when desc_match is not null then 1 else 0 end) as dTotal, sum(case when desc_match = 1 then 1 else 0 end) as dYes,
    sum(case when comp_match is not null then 1 else 0 end) as cTotal, sum(case when comp_match = 1 then 1 else 0 end) as cYes
    from reviews where target_id = ${userId} and direction = 'B2S' and created_at >= datetime('now', ${since})`);
  return {
    days: s.statsDays,
    shipPromise: ship,
    descMatch: { done: ev?.dYes ?? 0, total: ev?.dTotal ?? 0 },
    compMatch: { done: ev?.cYes ?? 0, total: ev?.cTotal ?? 0 },
  };
}

// param: userId 구매자. return: 확인된 사실(반송 약속·구성품 반환·책임이 확인된 훼손), 최근 statsDays일
export async function buyerTrust(userId: string) {
  const s = await loadTradeSettings();
  const since = sinceExpr(s.statsDays);
  const rows = db.all<{ requested: string; handover: string | null; status: string; inspection: string | null }>(sql`select return_requested_at as requested, return_handover_at as handover, status, inspection
    from orders where buyer_id = ${userId} and return_requested_at is not null and datetime(return_requested_at) >= datetime('now', ${since})`);
  const ret: Count = { done: 0, total: 0 };
  const comp: Count = { done: 0, total: 0 };
  for (const r of rows) {
    const dueDay = addHours(sqlToIso(r.requested), s.returnShipDays * 24).slice(0, 10);
    if (r.handover) { ret.total++; if (r.handover <= dueDay) ret.done++; }
    else if (r.status === "RETURN_REQUESTED" && new Date().toISOString().slice(0, 10) > dueDay) ret.total++;
    if (r.inspection) {
      try {
        const items = (JSON.parse(r.inspection).items ?? []) as { returned: boolean }[];
        if (items.length > 0) { comp.total++; if (items.every((i) => i.returned)) comp.done++; }
      } catch { /* 건너뜀 */ }
    }
  }
  const damage = db.get<{ n: number }>(sql`select count(*) as n from disputes d join orders o on o.id = d.order_id
    where o.buyer_id = ${userId} and d.status = 'RESOLVED' and d.buyer_fault = 1 and datetime(d.resolved_at) >= datetime('now', ${since})`)?.n ?? 0;
  return { days: s.statsDays, returnPromise: ret, componentsReturned: comp, confirmedDamage: damage };
}

// param: userId 판매자. return: 본인 분석용 — 써보기 구매 전환(구매 ÷ (구매 + 반납)), 반납 이유, 개선 제안
export async function sellerAnalysis(userId: string) {
  const s = await loadTradeSettings();
  const rows = db.all<{ status: string; reason: string | null }>(sql`select status, return_reason as reason from orders
    where seller_id = ${userId} and kind = 'TRIAL' and status in ('PURCHASED','RETURNED') and datetime(completed_at) >= datetime('now', ${sinceExpr(s.statsDays)})`);
  const bought = rows.filter((r) => r.status === "PURCHASED").length;
  const returned = rows.filter((r) => r.status === "RETURNED").length;
  const reasons = RETURN_REASONS.map((r) => ({ key: r.key, label: r.label, count: rows.filter((x) => x.status === "RETURNED" && x.reason === r.key).length })).filter((r) => r.count > 0);
  const TIPS: Record<string, string> = {
    SIZE: "치수·실측 사진을 더 넣어 보세요(길이·폭·발볼 등).",
    HEAVY: "무게(그램)와 다른 물건과 비교한 사진을 넣어 보세요.",
    USE: "어떤 용도에 맞고 맞지 않는지 설명에 적어 보세요.",
    MISMATCH: "상태 사진을 늘리고 흠집 위치를 설명에 적어 보세요.",
    DEFECT: "발송 전 작동 영상을 남겨 두면 분쟁을 줄일 수 있어요.",
  };
  return {
    days: s.statsDays, bought, returned, total: bought + returned,
    conversion: bought + returned > 0 ? bought / (bought + returned) : null,
    reasons, tips: reasons.filter((r) => TIPS[r.key]).map((r) => TIPS[r.key]),
  };
}

// param: userId 판매자. return: 완료 거래 수(판매자 채널 숫자)
export function completedAsSeller(userId: string) {
  return db.get<{ bought: number; returned: number }>(sql`select sum(case when status='PURCHASED' then 1 else 0 end) as bought,
    sum(case when status='RETURNED' then 1 else 0 end) as returned from orders where seller_id = ${userId}`) ?? { bought: 0, returned: 0 };
}

