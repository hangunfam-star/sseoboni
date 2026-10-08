import type { Metadata } from "next";
import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/admin";
import { categoryStats, costReactions, feedbackReasons, listingStats, recentFeedback, totals } from "@/lib/admin-metrics";
import { loadTrialPricing } from "@/lib/trial-pricing-store";
import { computeTrialCost } from "@/ui/trial-pricing";
import { PricingForm } from "./PricingForm";
import { formatWon, relativeTime } from "@/ui/presentation";
import { AdminLogin, AdminLogout } from "./AdminControls";

export const metadata: Metadata = { title: "운영자 결과 · 써보니", robots: { index: false, follow: false } };

const SELLER_TRY: Record<string, string> = { SELLER_TRY_YES: "허용", SELLER_TRY_CONDITIONAL: "조건부", SELLER_TRY_NO: "거절" };
const SMALL_SAMPLE = 30; // 이보다 적은 반응은 비율을 판단 근거로 쓰지 않는다

// param: a 분자, b 분모. return: 백분율 문자열, 분모 0이면 "-"
function pct(a: number, b: number): string {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : "-";
}

// 운영자 결과 화면(Gate 0: 시장검증 이벤트와 운영자용 결과 확인)
export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <div className="page admin-page">
        <h1 className="page-title">운영자 결과</h1>
        {adminConfigured()
          ? <AdminLogin />
          : <div className="empty-card"><strong>운영자 키가 설정되지 않았어요.</strong><small>app/.env에 ADMIN_KEY를 넣고 서버를 다시 시작하세요.</small></div>}
      </div>
    );
  }

  const t = totals();
  const listings = listingStats();
  const cats = categoryStats(listings);
  const reasons = feedbackReasons();
  const feedback = recentFeedback(30);
  const intents = t.tryWant + t.buyWant;
  const pricing = await loadTrialPricing();
  const reactions = costReactions();
  const SAMPLE_PRICES = [150000, 500000, 1000000];

  return (
    <div className="page admin-page">
      <div className="admin-head">
        <h1 className="page-title">운영자 결과</h1>
        <AdminLogout />
      </div>
      <p className="page-lead">모든 숫자는 실제 기록을 중복 없이 센 값이에요. 반응이 {SMALL_SAMPLE}건 미만이면 비율로 판단하지 마세요.</p>

      <section aria-labelledby="sum-title">
        <h2 className="section-title" id="sum-title">한눈에 보기</h2>
        <div className="admin-stats">
          <div><small>참여자</small><strong>{t.users}</strong></div>
          <div><small>판매 중 상품</small><strong>{t.activeListings}</strong></div>
          <div><small>상품 조회</small><strong>{t.views}</strong><small>로그인한 사람 {t.viewers}명</small></div>
          <div><small>써보고 싶어요</small><strong>{t.tryWant}</strong></div>
          <div><small>사고 싶어요</small><strong>{t.buyWant}</strong></div>
          <div><small>써보기 선호율</small><strong>{pct(t.tryWant, intents)}</strong><small>{intents < SMALL_SAMPLE ? "표본 적음" : `반응 ${intents}건`}</small></div>
          <div><small>찜</small><strong>{t.wishes}</strong></div>
          <div><small>찾는 사람</small><strong>{t.seekers}</strong></div>
          <div><small>의견</small><strong>{t.feedbacks}</strong></div>
        </div>
        <a className="secondary-button admin-export" href="/api/admin/export">전체 기록 CSV 내려받기</a>
      </section>

      <section aria-labelledby="price-title">
        <h2 className="section-title" id="price-title">써보기 가격 가설 · 비용 반응</h2>
        <p className="field-hint">마스터 기획 §8 써보기 비용은 아직 가설(HYPOTHESIS·VALIDATE_FIRST)이에요. 구매자 화면에는 &quot;검증용 예상 금액 · 확정 전 · 결제 없음&quot;으로 보여요. 지금 가격안: <b>{pricing.version}</b></p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>상품 가격</th>{pricing.hours.map((h) => <th key={h}>{h}시간 체험비</th>)}<th>{pricing.hours.at(-1)}시간 사면</th><th>{pricing.hours.at(-1)}시간 돌려보내면</th></tr></thead>
            <tbody>
              {SAMPLE_PRICES.map((p) => {
                const last = computeTrialCost(p, pricing.hours.at(-1)!, pricing);
                return (
                  <tr key={p}>
                    <th scope="row">{formatWon(p)}</th>
                    {pricing.hours.map((h) => <td key={h}>{formatWon(computeTrialCost(p, h, pricing).optionFee)}</td>)}
                    <td>{formatWon(last.purchaseTotal ?? last.purchaseWithoutShipping)}{last.purchaseTotal === null ? " + 배송" : ""}</td>
                    <td>{formatWon(last.returnTotal ?? last.returnWithoutShipping)}{last.returnTotal === null ? " + 왕복 배송" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>가격안</th><th>비용 본 사람</th><th>비로그인 조회</th><th>그래도 써볼래요</th><th>부담돼요</th><th>써볼래요 비율</th></tr></thead>
            <tbody>
              {reactions.length === 0 && <tr><td colSpan={6}>데이터 없음</td></tr>}
              {reactions.map((r) => (
                <tr key={r.version}>
                  <th scope="row">{r.version}</th><td>{r.viewers}</td><td>{r.anonViews}</td><td>{r.stillTry}</td><td>{r.decline}</td>
                  <td>{pct(r.stillTry, r.stillTry + r.decline)}{r.stillTry + r.decline < SMALL_SAMPLE ? " · 표본 적음" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="pricing-details">
          <summary>가격안 바꾸기</summary>
          <PricingForm current={pricing} />
        </details>
      </section>

      <section aria-labelledby="cat-title">
        <h2 className="section-title" id="cat-title">상품 종류별 판정 자료</h2>
        <p className="field-hint">계속(GO)·수정(MODIFY)·중단(STOP) 판정 기준은 아직 정하지 않았어요. 판정은 기준 승인 뒤 사람이 내립니다.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>종류</th><th>상품</th><th>본 사람</th><th>써보고</th><th>사고</th><th>써보기 선호율</th><th>찾는 사람</th><th>판매자 써보기 (허용/조건/거절/미답)</th><th>판정</th></tr></thead>
            <tbody>
              {cats.length === 0 && <tr><td colSpan={9}>데이터 없음</td></tr>}
              {cats.map((c) => (
                <tr key={c.category}>
                  <th scope="row">{c.category}</th>
                  <td>{c.listings}</td><td>{c.viewers}</td><td>{c.tryWant}</td><td>{c.buyWant}</td>
                  <td>{pct(c.tryWant, c.tryWant + c.buyWant)}</td><td>{c.seekers}</td>
                  <td>{c.sellerYes}/{c.sellerConditional}/{c.sellerNo}/{c.sellerUnknown}</td>
                  <td>판정 보류</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="listing-title">
        <h2 className="section-title" id="listing-title">상품별 반응</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>상품</th><th>종류</th><th>가격</th><th>상태</th><th>조회</th><th>본 사람</th><th>써보고</th><th>사고</th><th>찜</th><th>판매자 써보기</th></tr></thead>
            <tbody>
              {listings.length === 0 && <tr><td colSpan={10}>데이터 없음</td></tr>}
              {listings.map((l) => (
                <tr key={l.id}>
                  <th scope="row"><Link href={`/listings/${l.id}`}>{l.title}</Link><small>{l.seller ?? "판매자"} · {relativeTime(l.createdAt)}</small></th>
                  <td>{l.category ?? "미분류"}</td><td>{formatWon(l.price)}</td><td>{l.status}</td>
                  <td>{l.views}</td><td>{l.viewers}</td><td>{l.tryWant}</td><td>{l.buyWant}</td><td>{l.wishes}</td>
                  <td>{l.sellerTry ? SELLER_TRY[l.sellerTry] : "미답"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fb-title">
        <h2 className="section-title" id="fb-title">의견 · 망설인 이유</h2>
        {reasons.length === 0
          ? <p className="field-hint">아직 받은 의견이 없어요.</p>
          : <ul className="admin-reasons">{reasons.map((r) => <li key={r.reason}><span>{r.reason}</span><b>{r.count}</b></li>)}</ul>}
        <ul className="admin-feedback">
          {feedback.map((f, i) => (
            <li key={`${f.createdAt}-${i}`}>
              <small>{f.nickname ?? "테스터"} · {relativeTime(f.createdAt)}{f.tryLater ? ` · 써보기 열리면: ${f.tryLater}` : ""}</small>
              <strong>{f.reason}</strong>
              {f.message && <p>{f.message}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
