import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListThumb } from "@/components/ListThumb";
import { CopyText } from "@/components/CopyText";
import { getCurrentUserId } from "@/lib/session";
import { DISPUTE_REASONS, orderView } from "@/lib/orders";
import { reviewState } from "@/lib/reviews";
import { conditionLabel, formatWon, illustrationKind } from "@/ui/presentation";
import { RETURN_REASONS, kst, kstToday, ratioText } from "@/ui/trade-rules";
import { buyerTrust, gradesOf } from "@/lib/trade-stats";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { OrderActions } from "./OrderActions";
import { TradeReviewForm, TrialReviewForm } from "./ReviewForms";

export const metadata: Metadata = { title: "거래 · 써보니", robots: { index: false, follow: false } };

const STEPS = {
  TRIAL: [["AWAIT_PAYMENT", "입금"], ["PAID", "발송 대기"], ["SHIPPED", "배송"], ["TRIAL", "써보기"], ["DECIDE", "구매·반납"], ["DONE", "완료"]],
  BUY: [["AWAIT_PAYMENT", "입금"], ["PAID", "발송 대기"], ["SHIPPED", "배송"], ["RECEIVED", "받음"], ["DONE", "구매 완료"]],
} as const;
const STEP_OF: Record<string, string> = {
  AWAIT_PAYMENT: "AWAIT_PAYMENT", PAID: "PAID", SHIPPED: "SHIPPED", RECEIVED: "RECEIVED", TRIAL: "TRIAL", NEEDS_CHECK: "DECIDE",
  RETURN_REQUESTED: "DECIDE", RETURN_SHIPPED: "DECIDE", REFUND_DUE: "DECIDE", REFUND_SENT: "DECIDE", PURCHASED: "DONE", RETURNED: "DONE", CANCELLED: "DONE",
};
const EVENT_TEXT: Record<string, string> = {
  CREATED: "신청", PAYMENT_CONFIRMED: "입금 확인", SHIPPED: "발송", RECEIVED: "받음", AUTO_RECEIVED: "자동 받음 처리", EXTENDED: "기간 늘림",
  NEEDS_CHECK: "써보기 끝 · 확인 필요", PURCHASED: "구매 확정", AUTO_PURCHASED: "자동 구매 확정", RETURN_REQUESTED: "반납 신청", RETURN_SHIPPED: "반송",
  INSPECTED: "검수 완료", REFUND_SENT: "환불 보냄", REFUND_RECEIVED: "환불 받음", CANCELLED: "취소", AUTO_CANCELLED: "입금 기한 지나 자동 취소",
  CANCEL_AFTER_PAYMENT: "입금 뒤 취소", REFUND_ACCOUNT_SET: "환불 계좌 입력", DISPUTE_OPENED: "분쟁 신청", DISPUTE_RESOLVED: "분쟁 정리",
};
const WHO: Record<string, string> = { buyer: "구매자", seller: "판매자", system: "자동", admin: "운영자" };

// 거래 화면 — 구매자·판매자만. 지금 할 일·금액·배송·기록·후기를 한 곳에 보여 준다.
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  const v = await orderView(id, userId);
  if (!v || !v.role) notFound();
  const rs = await reviewState(id, userId);
  const steps = STEPS[v.kind];
  const cur = STEP_OF[v.status];
  const curIdx = steps.findIndex(([k]) => k === cur);
  const other = v.role === "buyer" ? v.sellerName : v.buyerName;
  const reason = RETURN_REASONS.find((r) => r.key === v.returnReason);
  // 판매자에게만: 구매자의 활동 등급과 확인된 기록(반송 약속·구성품 반환·책임이 확인된 훼손)
  // 반납 뒤 다음 검색 제안(구매자가 누를 때만 이동, 자동 신청 없음). 필요 없었다면 제안하지 않는다.
  const cat = v.snapshot.category ? await db.query.categories.findFirst({ where: eq(categories.name, v.snapshot.category) }) : undefined;
  const nextSearch = v.role === "buyer" && v.status === "RETURNED" && reason?.next
    ? { label: reason.next, href: reason.key === "SIZE" && v.snapshot.modelName ? `/?q=${encodeURIComponent(v.snapshot.modelName)}` : cat ? `/?c=${cat.id}` : "/" }
    : null;
  const buyerInfo = v.role === "seller" ? { grade: (await gradesOf(v.buyerId)).buyer, trust: await buyerTrust(v.buyerId) } : null;

  // 역할·상태별 지금 할 일 안내
  const todo = (() => {
    const b = v.role === "buyer";
    switch (v.status) {
      case "AWAIT_PAYMENT": return b ? `아래 계좌로 ${formatWon(v.money.payTotal)}을 보내 주세요. 입금자명은 '${v.depositName}'로 해 주세요. ${kst(v.deadlines.payBy)}까지 입금 확인이 안 되면 자동 취소돼요.` : `구매자가 ${formatWon(v.money.payTotal)}을 '${v.depositName}' 이름으로 보낼 거예요. 통장에서 확인되면 '입금 확인했어요'를 눌러 주세요.`;
      case "PAID": return b ? `판매자가 ${kst(v.deadlines.shipBy)}까지 발송할 예정이에요.` : `${kst(v.deadlines.shipBy)}까지 발송하고 송장번호를 입력해 주세요.`;
      case "SHIPPED": return b ? `물건을 받으면 '받았어요'를 눌러 주세요.${v.kind === "TRIAL" ? " 그때부터 써보기 시간이 시작돼요." : ""} ${kst(v.deadlines.autoReceiveAt)}에는 받은 것으로 자동 처리돼요.` : "구매자가 받으면 알려 드릴게요.";
      case "RECEIVED": return b ? `확인 뒤 '구매 확정'을 눌러 주세요. ${kst(v.deadlines.autoConfirmAt)}에 자동으로 구매 확정돼요.` : "구매자 확정을 기다리고 있어요.";
      case "TRIAL": return b ? `${kst(v.deadlines.trialEnd)}까지 써볼 수 있어요. 마음에 들면 '살게요', 아니면 '돌려보낼게요'를 눌러 주세요.` : `구매자가 ${kst(v.deadlines.trialEnd)}까지 써보는 중이에요.`;
      case "NEEDS_CHECK": return b ? `써보기 시간이 끝났어요. ${kst(v.deadlines.decideBy)}까지 고르지 않으면 구매로 확정돼요. 지금 돌려보내면 넘긴 시간만큼 다음 구간 체험료가 적용돼요.` : `써보기가 끝나 구매자 답을 기다려요. ${kst(v.deadlines.decideBy)}까지 답이 없으면 구매로 확정돼요.`;
      case "RETURN_REQUESTED": return b ? `${kst(v.deadlines.returnShipBy)}까지 반송하고 송장번호와 맡긴 날을 입력해 주세요.` : "구매자가 반송을 준비하고 있어요.";
      case "RETURN_SHIPPED": return b ? "판매자가 받아서 검수하면 환불이 진행돼요." : "물건을 받으면 구성품을 확인하고 '검수 완료'를 눌러 주세요.";
      case "REFUND_DUE": return b ? (v.refundTo ? `판매자가 ${formatWon(v.refundAmount ?? 0)}을 환불할 예정이에요.` : "환불 받을 계좌를 입력해 주세요.") : (v.refundTo ? `아래 계좌로 ${formatWon(v.refundAmount ?? 0)}을 보내고 '환불 보냈어요'를 눌러 주세요.` : "구매자가 환불 계좌를 입력하면 보여요.");
      case "REFUND_SENT": return b ? `통장에서 ${formatWon(v.refundAmount ?? 0)}이 확인되면 '환불 받았어요'를 눌러 주세요.` : "구매자가 환불을 확인하면 끝나요.";
      case "PURCHASED": return "구매가 완료됐어요.";
      case "RETURNED": return "반납이 완료됐어요.";
      case "CANCELLED": return `거래가 취소됐어요${v.cancelReason ? ` (${v.cancelReason})` : ""}.`;
    }
  })();

  return (
    <div className="page order-page">
      <div className="page-top">
        <Link className="icon-button" href="/orders" aria-label="거래 목록">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
      </div>
      <h1 className="page-title">{v.kind === "TRIAL" ? "써보기 거래" : "구매 거래"} <span className={`order-badge order-badge--${v.final ? "done" : "live"}`}>{v.statusLabel}</span></h1>

      <Link className="order-item" href={`/listings/${v.listingId}`}>
        <ListThumb photo={v.snapshot.photo} seed={v.listingId} kind={illustrationKind(v.snapshot.category, v.snapshot.modelName)} alt={v.snapshot.title} />
        <span><strong>{v.snapshot.title}</strong><small>{formatWon(v.price)} · {conditionLabel(v.snapshot.conditionGrade)}{v.kind === "TRIAL" ? ` · ${v.trialHours}시간 써보기` : ""}</small><small>{v.role === "buyer" ? "판매자" : "구매자"} {other}</small></span>
      </Link>

      {buyerInfo && (
        <p className="field-hint buyer-info">구매자 {v.buyerName} · 구매 {buyerInfo.grade.name} · 반송 약속 {ratioText(buyerInfo.trust.returnPromise.done, buyerInfo.trust.returnPromise.total)} · 구성품 반환 {ratioText(buyerInfo.trust.componentsReturned.done, buyerInfo.trust.componentsReturned.total)}{buyerInfo.trust.confirmedDamage > 0 ? ` · 확인된 훼손 ${buyerInfo.trust.confirmedDamage}건` : ""} (최근 {buyerInfo.trust.days}일)</p>
      )}
      <ol className="order-steps" aria-label="거래 단계">
        {steps.map(([k, label], i) => <li key={k} aria-current={i === curIdx ? "step" : undefined} data-done={i < curIdx || (v.final && i === curIdx) ? "true" : undefined}>{label}</li>)}
      </ol>

      <section className="order-todo" aria-label="지금 할 일">
        <p>{todo}</p>
        {v.opsFlag && <p className="field-hint">운영 확인: {v.opsFlag}</p>}
        {v.dispute?.status === "OPEN" && <p className="form-error">분쟁 확인 중 ({v.dispute.reason}) · 운영자가 확인할 때까지 금액 확정과 자동 처리를 멈췄어요.</p>}
        {v.dispute?.status === "RESOLVED" && <p className="field-hint">분쟁 정리: {v.dispute.resolution}</p>}
        <OrderActions orderId={v.id} role={v.role} kind={v.kind} status={v.status} today={kstToday()} actions={v.actions} tiers={v.tiers} trialHours={v.trialHours} components={v.snapshot.components}
          refundAmount={v.refundAmount} needsRefundAccount={v.status === "REFUND_DUE" && !v.refundTo} price={v.price}
          disputeOpen={v.dispute?.status === "OPEN"} canDispute={!["AWAIT_PAYMENT", "CANCELLED"].includes(v.status)} disputeReasons={DISPUTE_REASONS} />
      </section>

      {nextSearch && (
        <section className="order-box" aria-label="다음에 찾아볼 상품">
          <p>{reason?.label} 반납했어요. 원하면 이어서 찾아볼 수 있어요.</p>
          <Link className="secondary-button" href={nextSearch.href}>{nextSearch.label}</Link>
        </section>
      )}

      <section className="order-box" aria-labelledby="money-title">
        <h2 id="money-title"><Icon name="won" />금액</h2>
        <dl className="order-dl">
          <div><dt>판매자에게 보낼 금액</dt><dd>{formatWon(v.money.payTotal)} <small>상품 {formatWon(v.price)} + 발송비 {formatWon(v.shippingFee)}</small></dd></div>
          {v.kind === "TRIAL" && <div><dt>사면</dt><dd>추가 0원 <small>체험료 0원</small></dd></div>}
          {v.kind === "TRIAL" && !v.final && v.status !== "RETURN_REQUESTED" && v.refundAmount === null && <div><dt>지금 돌려보내면</dt><dd>{formatWon(v.money.refundIfReturn)} 환불 <small>상품가 − 체험료 {formatWon(v.money.returnCharge)} · 발송비·반송비 구매자 부담</small></dd></div>}
          {v.refundAmount !== null && <div><dt>{v.refundKind === "CANCEL" ? "취소 환불액" : "반납 환불액"}</dt><dd>{formatWon(v.refundAmount)}{v.refundKind === "RETURN" ? <small>상품가 − 체험료 {formatWon(v.trialFee ?? 0)}</small> : <small>입금액 전액</small>}</dd></div>}
          <div><dt>입금자명</dt><dd>{v.depositName}</dd></div>
          {v.sellerAccount && <div><dt>판매자 계좌</dt><dd>{v.sellerAccount.bank} {v.sellerAccount.account} · {v.sellerAccount.holder}{v.role === "buyer" && v.status === "AWAIT_PAYMENT" && <CopyText text={v.sellerAccount.account} label="계좌번호 복사" />}</dd></div>}
          {v.refundTo && <div><dt>환불 받을 계좌</dt><dd>{v.refundTo.bank} {v.refundTo.account} · {v.refundTo.holder}{v.role === "seller" && v.status === "REFUND_DUE" && <CopyText text={v.refundTo.account} label="계좌번호 복사" />}</dd></div>}
          {v.role === "seller" && v.status === "PURCHASED" && <div><dt>써보니 수수료</dt><dd>{formatWon(v.feeAmount ?? 0)} <small>베타 기간 {v.feePct ?? 0}% · 정식이었다면 {formatWon(v.virtualFee ?? 0)}</small></dd></div>}
        </dl>
        <p className="field-hint">써보니는 돈을 받거나 보관하지 않아요. 입금·환불은 구매자와 판매자가 직접 하고, 써보니는 금액 계산과 기록을 맡아요.</p>
      </section>

      <section className="order-box" aria-labelledby="ship-title">
        <h2 id="ship-title"><Icon name="truck" />배송</h2>
        <dl className="order-dl">
          {v.shipTo ? <div><dt>받는 곳</dt><dd>{v.shipTo.name} · {v.shipTo.phone}<br />{v.shipTo.address}{v.shipTo.memo ? <><br /><small>{v.shipTo.memo}</small></> : null}</dd></div>
            : v.role === "seller" && <div><dt>받는 곳</dt><dd><small>입금을 확인하면 보여요</small></dd></div>}
          {v.shipTracking && <div><dt>발송</dt><dd>{v.shipCarrier} {v.shipTracking}</dd></div>}
          {v.returnTracking && <div><dt>반송</dt><dd>{v.returnCarrier} {v.returnTracking} <small>맡긴 날 {v.returnHandoverAt}</small></dd></div>}
          {reason && <div><dt>반납 이유</dt><dd>{reason.label}{v.returnNote ? <small> · {v.returnNote}</small> : null}</dd></div>}
          {v.inspection && <div><dt>검수</dt><dd>{v.inspection.items.length ? v.inspection.items.map((x) => `${x.name} ${x.returned ? "✓" : "✗ 없음"}`).join(" · ") : "구성품 없음"}{v.inspection.note ? <small> · {v.inspection.note}</small> : null}</dd></div>}
        </dl>
      </section>

      {v.kind === "TRIAL" && v.questions.length > 0 && (
        <section className="order-box"><h2><Icon name="checklist" />써보며 확인할 점</h2><ul className="component-list">{v.questions.map((q) => <li key={q}>{q}</li>)}</ul></section>
      )}

      {rs && (rs.canReview || rs.mine || rs.theirs || rs.theirsWaiting || rs.canTrialReview || rs.trial) && (
        <section className="order-box" aria-labelledby="review-title">
          <h2 id="review-title"><Icon name="star" />후기</h2>
          {rs.canReview && <TradeReviewForm orderId={v.id} direction={rs.direction} targetName={other} />}
          {rs.mine && <p className="field-hint">내 평가: ★{rs.mine.stars} · {(JSON.parse(rs.mine.chips) as string[]).join(", ")}{rs.theirs ? "" : " (상대가 평가를 남기거나 7일이 지나면 함께 공개돼요)"}</p>}
          {rs.theirs && <p>받은 평가: ★{rs.theirs.stars} · {(JSON.parse(rs.theirs.chips) as string[]).join(", ")}{rs.theirs.sample ? ` · ${rs.theirs.sample}` : ""}{rs.theirs.body ? ` · ${rs.theirs.body}` : ""}</p>}
          {rs.theirsWaiting && <p className="field-hint">상대가 평가를 남겼어요. 내 평가를 남기면 함께 볼 수 있어요.</p>}
          {rs.canTrialReview && <TrialReviewForm orderId={v.id} questions={rs.questions} outcome={v.status} />}
          {rs.trial && <p className="field-hint">써보니 후기를 남겼어요: {rs.trial.learned ?? "답변을 남겼어요"}</p>}
        </section>
      )}

      <section className="order-box" aria-labelledby="log-title">
        <h2 id="log-title"><Icon name="clock" />거래 기록</h2>
        <ol className="order-log">{v.events.map((e, i) => <li key={i}><time>{kst(e.at)}</time> {EVENT_TEXT[e.type] ?? e.type} <small>{WHO[e.by]}</small></li>)}</ol>
        {v.threadId && <Link className="secondary-button" href={`/chats/${v.threadId}`}>채팅으로 이야기하기</Link>}
      </section>
    </div>
  );
}
