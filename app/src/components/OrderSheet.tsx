"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatWon } from "@/ui/presentation";
import { moneyOf } from "@/ui/trade-rules";
import type { TrialTier } from "@/ui/trial-pricing";

export type OrderSheetProps = {
  listingId: string;
  kind: "BUY" | "TRIAL";
  price: number;
  shippingFee: number;
  tiers: TrialTier[] | null;          // TRIAL: 판매자 조건(또는 승인된 제안 1개)
  proposalId: string | null;          // 승인된 제안으로 신청할 때
  questionOptions: string[];          // 상품 종류별 체험 전 질문 후보
  graceHours: number;                 // 체험이 끝난 뒤 답을 기다리는 시간
  paymentWaitHours: number;
  onClose: () => void;
};

// return: 구매·써보기 신청 시트(기간·궁금한 점·배송지·금액 안내·동의) → POST /api/orders → 거래 화면으로 이동
export function OrderSheet(p: OrderSheetProps) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const tiers = p.tiers ?? [];
  const [hours, setHours] = useState<number | null>(tiers.length ? (tiers.find((t) => t.hours === 48) ?? tiers[0]).hours : null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [ship, setShip] = useState({ name: "", phone: "", address: "", memo: "" });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fee = p.kind === "TRIAL" ? tiers.find((t) => t.hours === hours)?.fee ?? 0 : null;
  const m = moneyOf(p.price, p.shippingFee, fee);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [p]);

  function toggleQ(q: string) {
    setQuestions((cur) => (cur.includes(q) ? cur.filter((x) => x !== q) : cur.length >= 3 ? cur : [...cur, q]));
  }
  function addCustom() {
    const q = custom.trim().slice(0, 20);
    if (q && !questions.includes(q) && questions.length < 3) setQuestions([...questions, q]);
    setCustom("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!agree) { setError("거래 방법과 기한 안내를 확인해 주세요."); return; }
    const pendingCustom = custom.trim().slice(0, 20);
    const qs = pendingCustom && !questions.includes(pendingCustom) && questions.length < 3 ? [...questions, pendingCustom] : questions;
    setPending(true);
    setError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: p.listingId, kind: p.kind, hours: hours ?? undefined, proposalId: p.proposalId ?? undefined, questions: p.kind === "TRIAL" ? qs : [], shipTo: ship }),
    });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (res.status === 401) { setError("닉네임을 정하고 시작하면 신청할 수 있어요."); return; }
    if (!res.ok) { setError(d.error ?? "신청하지 못했어요."); return; }
    router.push(`/orders/${d.orderId}`);
  }

  const title = p.kind === "TRIAL" ? "써보기 신청" : "구매 신청";
  return (
    <div className="sheet" role="presentation" onClick={p.onClose}>
      <div ref={panel} className="sheet__panel order-sheet" role="dialog" aria-modal="true" aria-labelledby="order-sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2 id="order-sheet-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="닫기" onClick={p.onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <form className="proposal-form" onSubmit={submit}>
          {p.kind === "TRIAL" && (
            <>
              <fieldset className="field">
                <legend>써볼 기간 <small>(받은 때부터)</small></legend>
                <div className="segmented">
                  {tiers.map((t) => (
                    <button key={t.hours} type="button" aria-pressed={hours === t.hours} onClick={() => setHours(t.hours)}>
                      {t.hours}시간<small>{formatWon(t.fee)}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>써보며 확인하고 싶은 점 <small>(선택, 3개까지 · 후기 쓸 때 다시 보여 줘요)</small></legend>
                <div className="component-picker__chips">
                  {p.questionOptions.map((q) => <button key={q} type="button" className="chip" aria-pressed={questions.includes(q)} onClick={() => toggleQ(q)}>{q}</button>)}
                  {questions.filter((q) => !p.questionOptions.includes(q)).map((q) => <button key={q} type="button" className="chip" aria-pressed="true" aria-label={`${q} 빼기`} onClick={() => toggleQ(q)}>{q} ×</button>)}
                </div>
                <div className="component-picker__add">
                  <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addCustom(); } }} maxLength={20} placeholder="직접 적기 (예: 문턱 통과)" aria-label="확인하고 싶은 점 직접 적기" disabled={questions.length >= 3} />
                  <button type="button" className="secondary-button" onClick={addCustom} disabled={questions.length >= 3 || !custom.trim()}>추가</button>
                </div>
              </fieldset>
            </>
          )}
          <fieldset className="field order-ship">
            <legend>받는 곳 <small>(판매자는 입금 확인 뒤에만 볼 수 있어요)</small></legend>
            <input value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} placeholder="받는 분 이름" aria-label="받는 분 이름" maxLength={20} required autoComplete="name" />
            <input value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value.replace(/[^\d-]/g, "") })} placeholder="휴대폰 번호" aria-label="휴대폰 번호" inputMode="tel" maxLength={13} required autoComplete="tel" />
            <textarea value={ship.address} onChange={(e) => setShip({ ...ship, address: e.target.value })} placeholder="주소 (도로명, 동·호수까지)" aria-label="주소" rows={2} maxLength={200} required autoComplete="street-address" />
            <input value={ship.memo} onChange={(e) => setShip({ ...ship, memo: e.target.value })} placeholder="배송 메모 (선택)" aria-label="배송 메모" maxLength={60} />
          </fieldset>
          <div className="order-money" aria-label="금액 안내">
            <div><span>판매자에게 보낼 금액</span><strong>{formatWon(m.payTotal)}</strong><small>상품 {formatWon(p.price)} + 발송비 {formatWon(p.shippingFee)}</small></div>
            {p.kind === "TRIAL" ? (
              <>
                <div><span>써보고 사면</span><strong>추가 0원</strong><small>체험료 0원</small></div>
                <div><span>써보고 돌려보내면</span><strong>{formatWon(m.refundIfReturn)} 환불</strong><small>상품가 − 체험료 {formatWon(m.returnCharge)} · 발송비·반송비는 구매자 부담</small></div>
              </>
            ) : <div><span>받은 뒤</span><strong>구매 확정</strong><small>문제가 있으면 확정 전에 분쟁을 신청할 수 있어요</small></div>}
          </div>
          <label className="order-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              돈은 써보니가 아니라 <b>판매자 계좌로 직접</b> 보내요(입금 기한 {p.paymentWaitHours}시간).
              {p.kind === "TRIAL" && <> 써보기 시간은 <b>받은 때부터</b> 시작하고, 끝난 뒤 {p.graceHours}시간 안에 답이 없으면 <b>구매로 확정</b>돼요. 기간을 넘겨 돌려보내면 다음 구간 체험료가 적용돼요.</>}
            </span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="dark-button" type="submit" disabled={pending}>{pending ? "신청 중…" : `${title}하기`}</button>
        </form>
      </div>
    </div>
  );
}
