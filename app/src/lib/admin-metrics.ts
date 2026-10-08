// 운영자 결과 화면 집계. 모든 숫자는 DB 원자료를 중복 제거해 센 실제 값이다(추정·보정 없음).
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type Totals = {
  users: number; activeListings: number; views: number; viewers: number;
  tryWant: number; buyWant: number; wishes: number; seekers: number; feedbacks: number;
};
export type ListingStat = {
  id: string; title: string; status: string; price: number; category: string | null; seller: string | null;
  views: number; viewers: number; tryWant: number; buyWant: number; wishes: number; sellerTry: string | null; createdAt: string;
};
export type CategoryStat = {
  category: string; listings: number; viewers: number; tryWant: number; buyWant: number; wishes: number; seekers: number;
  sellerYes: number; sellerConditional: number; sellerNo: number; sellerUnknown: number;
};
export type FeedbackRow = { createdAt: string; nickname: string | null; reason: string; tryLater: string | null; message: string | null };

// return: 전체 요약 숫자
export function totals(): Totals {
  return db.get<Totals>(sql`select
    (select count(*) from users where status = 'ACTIVE') as users,
    (select count(*) from listings where status = 'ACTIVE') as activeListings,
    (select count(*) from market_validation_events where event_type = 'VIEW_LISTING') as views,
    (select count(distinct user_id) from market_validation_events where event_type = 'VIEW_LISTING') as viewers,
    (select count(distinct user_id || '|' || listing_id) from market_validation_events where event_type = 'CLICK_TRY_WANT') as tryWant,
    (select count(distinct user_id || '|' || listing_id) from market_validation_events where event_type = 'CLICK_BUY_WANT') as buyWant,
    (select count(*) from wishlists) as wishes,
    (select count(distinct user_id) from demand_intents where active = 1) as seekers,
    (select count(*) from market_validation_events where event_type = 'FEEDBACK') as feedbacks`);
}

// return: 상품별 반응(삭제된 상품 제외, 최신 등록순)
export function listingStats(): ListingStat[] {
  return db.all<ListingStat>(sql`select l.id, l.title, l.status, l.price, c.name as category, u.nickname as seller, l.created_at as createdAt,
    (select count(*) from market_validation_events e where e.listing_id = l.id and e.event_type = 'VIEW_LISTING') as views,
    (select count(distinct e.user_id) from market_validation_events e where e.listing_id = l.id and e.event_type = 'VIEW_LISTING') as viewers,
    (select count(distinct e.user_id) from market_validation_events e where e.listing_id = l.id and e.event_type = 'CLICK_TRY_WANT') as tryWant,
    (select count(distinct e.user_id) from market_validation_events e where e.listing_id = l.id and e.event_type = 'CLICK_BUY_WANT') as buyWant,
    (select count(*) from wishlists w where w.listing_id = l.id) as wishes,
    (select e.event_type from market_validation_events e where e.listing_id = l.id and e.event_type like 'SELLER_TRY_%' order by e.created_at desc, e.rowid desc limit 1) as sellerTry
    from listings l
    left join product_models m on m.id = l.model_id
    left join categories c on c.id = m.category_id
    left join users u on u.id = l.seller_id
    where l.status != 'REMOVED'
    order by l.created_at desc`);
}

// param: rows 상품별 반응. return: 상품 종류별 합계(찾는 사람 수 포함)
export function categoryStats(rows: ListingStat[]): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  const get = (name: string) => {
    let c = map.get(name);
    if (!c) {
      c = { category: name, listings: 0, viewers: 0, tryWant: 0, buyWant: 0, wishes: 0, seekers: 0, sellerYes: 0, sellerConditional: 0, sellerNo: 0, sellerUnknown: 0 };
      map.set(name, c);
    }
    return c;
  };
  for (const r of rows) {
    const c = get(r.category ?? "미분류");
    c.listings += 1;
    c.wishes += r.wishes;
    if (r.sellerTry === "SELLER_TRY_YES") c.sellerYes += 1;
    else if (r.sellerTry === "SELLER_TRY_CONDITIONAL") c.sellerConditional += 1;
    else if (r.sellerTry === "SELLER_TRY_NO") c.sellerNo += 1;
    else c.sellerUnknown += 1;
  }
  const seekers = db.all<{ category: string | null; seekers: number }>(sql`select c.name as category, count(distinct d.user_id) as seekers
    from demand_intents d join product_models m on m.id = d.model_id left join categories c on c.id = m.category_id
    where d.active = 1 group by c.name`);
  for (const s of seekers) get(s.category ?? "미분류").seekers = s.seekers;
  // 본 사람·써보고·사고는 상품별 값을 더하지 않고 종류 단위로 사람을 중복 없이 센다.
  const people = db.all<{ category: string | null; viewers: number; tryWant: number; buyWant: number }>(sql`select c.name as category,
    count(distinct case when e.event_type = 'VIEW_LISTING' then e.user_id end) as viewers,
    count(distinct case when e.event_type = 'CLICK_TRY_WANT' then e.user_id end) as tryWant,
    count(distinct case when e.event_type = 'CLICK_BUY_WANT' then e.user_id end) as buyWant
    from market_validation_events e join listings l on l.id = e.listing_id
    join product_models m on m.id = l.model_id left join categories c on c.id = m.category_id
    where l.status != 'REMOVED' group by c.name`);
  for (const p of people) {
    const c = map.get(p.category ?? "미분류");
    if (c) { c.viewers = p.viewers; c.tryWant = p.tryWant; c.buyWant = p.buyWant; }
  }
  return [...map.values()].sort((a, b) => b.tryWant + b.seekers - (a.tryWant + a.seekers));
}

// param: limit 최대 개수. return: 최근 의견(이탈 사유)
export function recentFeedback(limit = 50): FeedbackRow[] {
  const rows = db.all<{ createdAt: string; nickname: string | null; metadata: string | null }>(sql`select e.created_at as createdAt, u.nickname as nickname, e.metadata as metadata
    from market_validation_events e left join users u on u.id = e.user_id
    where e.event_type = 'FEEDBACK' order by e.created_at desc limit ${limit}`);
  return rows.map((r) => {
    let m: { reason?: string; tryLater?: string | null; message?: string | null } = {};
    try { m = JSON.parse(r.metadata ?? "{}"); } catch { /* 깨진 metadata는 빈 값으로 둔다 */ }
    return { createdAt: r.createdAt, nickname: r.nickname, reason: m.reason ?? "미확인", tryLater: m.tryLater ?? null, message: m.message ?? null };
  });
}

// return: 이유별 의견 수(많은 순)
export function feedbackReasons(): { reason: string; count: number }[] {
  return db.all<{ reason: string; count: number }>(sql`select coalesce(json_extract(metadata, '$.reason'), '미확인') as reason, count(*) as count
    from market_validation_events where event_type = 'FEEDBACK' group by reason order by count desc`);
}

// return: CSV로 내보낼 전체 이벤트(오래된 순)
export function eventRows(): Record<string, string | number | null>[] {
  return db.all(sql`select e.created_at, e.event_type, e.listing_id, l.title as listing_title, c.name as category,
    m.brand, m.model_name, e.user_id, u.nickname, e.metadata
    from market_validation_events e
    left join listings l on l.id = e.listing_id
    left join product_models m on m.id = coalesce(e.model_id, l.model_id)
    left join categories c on c.id = m.category_id
    left join users u on u.id = e.user_id
    order by e.created_at`);
}

export type TermsStat = {
  id: string; title: string; price: number; dailyFee: number | null; hours: string | null; shipping: number | null;
  costViewers: number; stillTry: number; decline: number; proposals: number; accepted: number; avgOfferPct: number | null;
};

// return: 상품별 판매자 써보기 조건과 반응(비용 본 사람·이 조건으로 써볼래요·부담돼요·제안). 사람 수는 중복 제거.
export function termsStats(): TermsStat[] {
  return db.all<TermsStat>(sql`select l.id, l.title, l.price, t.daily_fee as dailyFee, t.hours, t.shipping_one_way as shipping,
    (select count(distinct e.user_id) from market_validation_events e where e.listing_id = l.id and e.event_type = 'TRIAL_COST_VIEW') as costViewers,
    (select count(distinct e.user_id) from market_validation_events e where e.listing_id = l.id and e.event_type = 'STILL_TRY_CLICK') as stillTry,
    (select count(distinct e.user_id) from market_validation_events e where e.listing_id = l.id and e.event_type = 'TRIAL_COST_DECLINE') as decline,
    (select count(*) from trial_proposals p where p.listing_id = l.id) as proposals,
    (select count(*) from trial_proposals p where p.listing_id = l.id and p.status = 'ACCEPTED') as accepted,
    (select round(avg(p.offer_fee * 100.0 / l.price), 2) from trial_proposals p where p.listing_id = l.id) as avgOfferPct
    from listings l left join listing_trial_terms t on t.listing_id = l.id
    where l.status != 'REMOVED' order by l.created_at desc`);
}

export type ProposalTotals = { total: number; pending: number; accepted: number; declined: number; cancelled: number; expired: number; onNoListings: number; acceptedOnNo: number };

// return: 제안 합계. onNoListings는 제안을 보낸 시점에 판매자 답이 '바로 판매만'(NO)이던 상품에 온 제안
export function proposalTotals(): ProposalTotals {
  return db.get<ProposalTotals>(sql`with answered as (
      select p.status,
        (select e.event_type from market_validation_events e where e.listing_id = p.listing_id and e.event_type like 'SELLER_TRY_%' and e.created_at <= p.created_at
          order by e.created_at desc, e.rowid desc limit 1) as answer
      from trial_proposals p)
    select count(*) as total,
      coalesce(sum(status = 'PENDING'), 0) as pending, coalesce(sum(status = 'ACCEPTED'), 0) as accepted, coalesce(sum(status = 'DECLINED'), 0) as declined,
      coalesce(sum(status = 'CANCELLED'), 0) as cancelled, coalesce(sum(status = 'EXPIRED'), 0) as expired,
      coalesce(sum(answer = 'SELLER_TRY_NO'), 0) as onNoListings,
      coalesce(sum(answer = 'SELLER_TRY_NO' and status = 'ACCEPTED'), 0) as acceptedOnNo
    from answered`)!;
}

export type ProposalRow = { title: string; price: number; hours: number; offerFee: number; status: string; buyer: string | null; createdAt: string };

// return: 최근 제안 30개
export function recentProposals(): ProposalRow[] {
  return db.all<ProposalRow>(sql`select l.title, l.price, p.hours, p.offer_fee as offerFee, p.status, u.nickname as buyer, p.created_at as createdAt
    from trial_proposals p join listings l on l.id = p.listing_id left join users u on u.id = p.buyer_id order by p.created_at desc limit 30`);
}
