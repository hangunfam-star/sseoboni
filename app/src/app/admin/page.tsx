import type { Metadata } from "next";
import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/admin";
import { categoryStats, feedbackReasons, listingStats, proposalTotals, recentFeedback, recentProposals, termsStats, totals } from "@/lib/admin-metrics";
import { expireOldProposals, tiersOf } from "@/lib/trial-terms";
import { loadPlatformFee } from "@/lib/platform-fee-store";
import { currentFeePct } from "@/ui/platform-fee";
import { PlatformFeeForm } from "./PlatformFeeForm";
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
  expireOldProposals();
  const terms = termsStats();
  const pt = proposalTotals();
  const proposals = recentProposals();
  const feeConfig = await loadPlatformFee();
  const feeNow = currentFeePct(feeConfig);
  const PROPOSAL_LABEL: Record<string, string> = { PENDING: "대기", ACCEPTED: "승인", DECLINED: "거절", CANCELLED: "취소", EXPIRED: "만료" };

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
        <h2 className="section-title" id="price-title">써보기 조건 · 제안</h2>
        <p className="field-hint">체험비는 판매자가 등록할 때 정하고, 구매자는 직접 제안할 수 있어요. 써보고 사면 체험비 0원, 돌려보내면 체험비를 받아요. 결제·배송은 아직 없어요(통장 방식은 추후 결정).</p>
        <div className="fee-now">
          <p>오늘 수수료 <b>{feeNow.pct}%</b>{feeNow.promo ? ` · ${feeNow.promo.label}(${feeNow.promo.start}~${feeNow.promo.end})` : " · 기본"} — 미리 결제 금액 기준. 사면 판매자 입금액에서, 돌려보내면 구매자 환불금에서 빼요.</p>
          <details className="pricing-details">
            <summary>수수료·특정 기간 설정</summary>
            <PlatformFeeForm current={feeConfig} />
          </details>
        </div>
        <div className="admin-stats">
          <div><small>받은 제안</small><strong>{pt.total}</strong></div>
          <div><small>승인</small><strong>{pt.accepted}</strong><small>승인율 {pct(pt.accepted, pt.accepted + pt.declined)}</small></div>
          <div><small>대기</small><strong>{pt.pending}</strong><small>거절 {pt.declined} · 만료 {pt.expired} · 취소 {pt.cancelled}</small></div>
          <div><small>바로 판매만이던 상품에 온 제안</small><strong>{pt.onNoListings}</strong><small>그중 승인 {pt.acceptedOnNo}</small></div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>상품</th><th>가격</th><th>구간별 체험비(가격 대비)</th><th>편도 배송</th><th>비용 본 사람</th><th>이 조건으로 써볼래요</th><th>부담돼요</th><th>제안(승인)</th><th>평균 제안(가격 대비)</th></tr></thead>
            <tbody>
              {terms.length === 0 && <tr><td colSpan={9}>데이터 없음</td></tr>}
              {terms.map((r) => (
                <tr key={r.id}>
                  <th scope="row"><Link href={`/listings/${r.id}`}>{r.title}</Link></th>
                  <td>{formatWon(r.price)}</td>
                  <td>{r.dailyFee === null ? "조건 없음" : tiersOf({ hours: r.hours ?? "[]", dailyFee: r.dailyFee, tierFees: r.tierFees }).map((t) => `${t.hours}h ${formatWon(t.fee)}(${((t.fee / r.price) * 100).toFixed(1)}%)`).join(" · ")}</td>
                  <td>{r.shipping === null ? (r.dailyFee === null ? "-" : "모름") : formatWon(r.shipping)}</td>
                  <td>{r.costViewers}</td><td>{r.stillTry}</td><td>{r.decline}</td>
                  <td>{r.proposals}({r.accepted})</td>
                  <td>{r.avgOfferPct === null ? "-" : `${r.avgOfferPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>최근 제안 상품</th><th>구매자</th><th>기간</th><th>제안 체험비</th><th>가격 대비</th><th>상태</th></tr></thead>
            <tbody>
              {proposals.length === 0 && <tr><td colSpan={6}>데이터 없음</td></tr>}
              {proposals.map((r, k) => (
                <tr key={k}>
                  <th scope="row">{r.title}<small>{relativeTime(r.createdAt)}</small></th>
                  <td>{r.buyer ?? "구매자"}</td><td>{r.hours}h</td><td>{formatWon(r.offerFee)}</td>
                  <td>{((r.offerFee / r.price) * 100).toFixed(2)}%</td><td>{PROPOSAL_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
