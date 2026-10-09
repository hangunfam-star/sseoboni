"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BANKS, CARRIERS, RETURN_REASONS, type Action } from "@/ui/trade-rules";
import { formatWon } from "@/ui/presentation";

type Props = {
  orderId: string;
  role: "buyer" | "seller";
  kind: "BUY" | "TRIAL";
  status: string;
  today: string;                 // 한국 날짜(서버에서 계산)
  actions: Action[];
  tiers: { hours: number; fee: number }[] | null;
  trialHours: number | null;
  components: string[];
  refundAmount: number | null;
  needsRefundAccount: boolean;   // 환불 대기인데 구매자 환불 계좌가 없음
  price: number;
  disputeOpen: boolean;
  canDispute: boolean;
  disputeReasons: readonly string[];
};

// 은행·계좌·예금주 입력(환불 받을 계좌)
function BankFields({ value, onChange, idPrefix }: { value: { bank: string; account: string; holder: string }; onChange: (v: { bank: string; account: string; holder: string }) => void; idPrefix: string }) {
  return (
    <div className="order-bank">
      <select value={value.bank} onChange={(e) => onChange({ ...value, bank: e.target.value })} aria-label="은행" id={`${idPrefix}-bank`}>
        <option value="">은행 선택</option>
        {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <input value={value.account} onChange={(e) => onChange({ ...value, account: e.target.value.replace(/[^\d-]/g, "") })} inputMode="numeric" placeholder="계좌번호" aria-label="계좌번호" maxLength={20} />
      <input value={value.holder} onChange={(e) => onChange({ ...value, holder: e.target.value })} placeholder="예금주" aria-label="예금주" maxLength={20} />
    </div>
  );
}

// 거래 화면의 행동 버튼과 입력. 서버가 허락한 행동(actions)만 보여 준다.
export function OrderActions(p: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const today = p.today;
  const [handover, setHandover] = useState(today);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [bank, setBank] = useState({ bank: "", account: "", holder: "" });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [extendTo, setExtendTo] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpenForm, setDisputeOpenForm] = useState(false);
  const [dReason, setDReason] = useState("");
  const [dDetail, setDDetail] = useState("");

  async function send(action: string, body: Record<string, unknown> = {}, confirmText?: string) {
    if (pending) return;
    if (confirmText && !confirm(confirmText)) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/orders/${p.orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(d.error ?? "처리하지 못했어요."); return; }
    setCarrier(""); setTracking(""); setNote(""); setCancelOpen(false);
    router.refresh();
  }

  async function dispute() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/orders/${p.orderId}/dispute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: dReason, detail: dDetail }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(d.error ?? "신청하지 못했어요."); return; }
    setDisputeOpenForm(false);
    router.refresh();
  }

  const has = (a: Action) => p.actions.includes(a);
  const longer = (p.tiers ?? []).filter((t) => p.trialHours !== null && t.hours > p.trialHours);
  const reasonInfo = RETURN_REASONS.find((r) => r.key === reason);

  return (
    <div className="order-actions">
      {has("CONFIRM_PAYMENT") && (
        <button type="button" className="dark-button" disabled={pending} onClick={() => send("CONFIRM_PAYMENT", {}, "통장에서 입금자명과 금액을 확인했나요? 확인하면 구매자에게 배송지가 보여요.")}>입금 확인했어요</button>
      )}

      {has("SHIP") && (
        <form className="order-form" onSubmit={(e) => { e.preventDefault(); void send("SHIP", { carrier, tracking }); }}>
          <strong>발송 정보 입력</strong>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="택배사" required>
            <option value="">택배사 선택</option>
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="송장번호" aria-label="송장번호" maxLength={30} required />
          <button className="dark-button" type="submit" disabled={pending}>발송했어요</button>
        </form>
      )}

      {has("RECEIVED") && (
        <button type="button" className="dark-button" disabled={pending} onClick={() => send("RECEIVED", {}, p.kind === "TRIAL" ? "물건을 받았나요? 지금부터 써보기 시간이 시작돼요." : "물건을 받았나요?")}>받았어요</button>
      )}

      {(has("PURCHASE") || has("RETURN")) && (
        <div className="order-decide">
          {has("PURCHASE") && (
            <button type="button" className="dark-button" disabled={pending} onClick={() => send("PURCHASE", {}, p.kind === "TRIAL" ? "구매를 확정할까요? 체험료는 0원이고 추가로 낼 돈은 없어요. 확정 뒤에는 되돌릴 수 없어요." : "구매를 확정할까요? 확정 뒤에는 되돌릴 수 없어요.")}>
              {p.kind === "TRIAL" ? "살게요 (구매 확정)" : "구매 확정"}
            </button>
          )}
          {has("RETURN") && (
            <details className="order-return">
              <summary>돌려보낼게요</summary>
              <form className="order-form" onSubmit={(e) => { e.preventDefault(); void send("RETURN", { reason, note, refundAccount: bank }, "반납을 신청할까요? 환불 예정액이 확정돼요."); }}>
                <strong>반납 이유</strong>
                <div className="component-picker__chips">
                  {RETURN_REASONS.map((r) => <button key={r.key} type="button" className="chip" aria-pressed={reason === r.key} onClick={() => setReason(r.key)}>{r.label}</button>)}
                </div>
                {reasonInfo && "dispute" in reasonInfo && reasonInfo.dispute && <p className="field-hint">설명과 다르거나 하자가 있다면 반납과 함께 아래 &apos;문제가 있어요&apos;로 분쟁을 신청해 주세요. 정상 반납 비용을 그대로 적용하지 않도록 운영자가 확인해요.</p>}
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (선택)" aria-label="반납 메모" maxLength={200} />
                <strong>환불 받을 계좌</strong>
                <BankFields value={bank} onChange={setBank} idPrefix="return" />
                <button className="secondary-button" type="submit" disabled={pending || !reason}>반납 신청</button>
              </form>
            </details>
          )}
        </div>
      )}

      {has("EXTEND") && longer.length > 0 && (
        <div className="order-form">
          <strong>더 써보기 (추가 입금 없음)</strong>
          <div className="segmented">
            {longer.map((t) => <button key={t.hours} type="button" aria-pressed={extendTo === t.hours} onClick={() => setExtendTo(t.hours)}>{t.hours}시간<small>{formatWon(t.fee)}</small></button>)}
          </div>
          <button type="button" className="secondary-button" disabled={pending || extendTo === null} onClick={() => send("EXTEND", { hours: extendTo }, `${extendTo}시간으로 늘릴까요? 돌려보내면 그 구간 체험료가 적용돼요.`)}>기간 늘리기</button>
        </div>
      )}

      {has("RETURN_SHIPPED") && (
        <form className="order-form" onSubmit={(e) => { e.preventDefault(); void send("RETURN_SHIPPED", { carrier, tracking, handoverDate: handover }); }}>
          <strong>반송 정보 입력</strong>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="반송 택배사" required>
            <option value="">택배사 선택</option>
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="송장번호" aria-label="반송 송장번호" maxLength={30} required />
          <label className="order-inline">택배를 맡긴 날 <input type="date" value={handover} max={today} onChange={(e) => setHandover(e.target.value)} aria-label="택배를 맡긴 날" required /></label>
          <small className="field-hint">반송 기한은 택배를 맡긴 날로 판단해요. 택배가 늦게 도착해도 구매자 지각이 아니에요.</small>
          <button className="dark-button" type="submit" disabled={pending}>반송했어요</button>
        </form>
      )}

      {has("INSPECT") && (
        <form className="order-form" onSubmit={(e) => { e.preventDefault(); void send("INSPECT", { components: checks, note }, "검수를 마칠까요? 환불 대기로 넘어가요."); }}>
          <strong>돌아온 물건 검수</strong>
          {p.components.length === 0 ? <p className="field-hint">등록된 구성품이 없어요. 상태를 확인하고 메모를 남겨 주세요.</p> : (
            <ul className="order-checks">
              {p.components.map((c) => (
                <li key={c}><label><input type="checkbox" checked={Boolean(checks[c])} onChange={(e) => setChecks({ ...checks, [c]: e.target.checked })} /> {c} 돌아왔어요</label></li>
              ))}
            </ul>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="검수 메모 (선택)" aria-label="검수 메모" maxLength={300} />
          <small className="field-hint">빠진 구성품이나 훼손이 있으면 검수 뒤 &apos;문제가 있어요&apos;로 분쟁을 신청하세요. 환불액은 운영자 확인 없이 줄일 수 없어요.</small>
          <button className="dark-button" type="submit" disabled={pending}>검수 완료</button>
        </form>
      )}

      {p.needsRefundAccount && p.role === "buyer" && (
        <form className="order-form" onSubmit={(e) => { e.preventDefault(); void send("SET_REFUND_ACCOUNT", { refundAccount: bank }); }}>
          <strong>환불 받을 계좌를 입력해 주세요</strong>
          <BankFields value={bank} onChange={setBank} idPrefix="refund" />
          <button className="dark-button" type="submit" disabled={pending}>계좌 저장</button>
        </form>
      )}

      {has("REFUND_SENT") && (
        <button type="button" className="dark-button" disabled={pending} onClick={() => send("REFUND_SENT", {}, `${formatWon(p.refundAmount ?? 0)}을 구매자 계좌로 보냈나요?`)}>{formatWon(p.refundAmount ?? 0)} 환불 보냈어요</button>
      )}
      {has("REFUND_RECEIVED") && (
        <button type="button" className="dark-button" disabled={pending} onClick={() => send("REFUND_RECEIVED", {}, `통장에서 ${formatWon(p.refundAmount ?? 0)}이 들어온 것을 확인했나요?`)}>{formatWon(p.refundAmount ?? 0)} 환불 받았어요</button>
      )}

      {has("CANCEL") && (
        <div className="order-cancel">
          {!cancelOpen ? <button type="button" className="text-button" onClick={() => setCancelOpen(true)}>거래 취소</button> : (
            <form className="order-form" onSubmit={(e) => { e.preventDefault(); void send("CANCEL", { reason: note, refundAccount: bank }, "거래를 취소할까요?"); }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="취소 이유 (선택)" aria-label="취소 이유" maxLength={100} />
              {p.role === "buyer" && p.status === "PAID" && (
                <>
                  <small className="field-hint">판매자가 입금을 확인했으니 전액을 돌려받을 계좌를 적어 주세요.</small>
                  <BankFields value={bank} onChange={setBank} idPrefix="cancel" />
                </>
              )}
              <div className="order-inline"><button className="secondary-button" type="submit" disabled={pending}>취소하기</button><button type="button" className="text-button" onClick={() => setCancelOpen(false)}>닫기</button></div>
            </form>
          )}
        </div>
      )}

      {p.canDispute && !p.disputeOpen && (
        <div className="order-dispute">
          {!disputeOpenForm ? <button type="button" className="text-button" onClick={() => setDisputeOpenForm(true)}>문제가 있어요 (분쟁 신청)</button> : (
            <form className="order-form" onSubmit={(e) => { e.preventDefault(); void dispute(); }}>
              <strong>분쟁 신청</strong>
              <div className="component-picker__chips">
                {p.disputeReasons.map((r) => <button key={r} type="button" className="chip" aria-pressed={dReason === r} onClick={() => setDReason(r)}>{r}</button>)}
              </div>
              <textarea value={dDetail} onChange={(e) => setDDetail(e.target.value)} rows={3} maxLength={500} placeholder="무슨 일인지 적어 주세요 (5자 이상). 사진은 채팅으로 보내 주세요." aria-label="분쟁 내용" />
              <small className="field-hint">분쟁 중에는 자동 처리와 금액 확정을 멈추고 운영자가 양쪽 기록을 확인해요. 분쟁 신청만으로 점수가 깎이지 않아요.</small>
              <div className="order-inline"><button className="secondary-button" type="submit" disabled={pending || !dReason}>신청하기</button><button type="button" className="text-button" onClick={() => setDisputeOpenForm(false)}>닫기</button></div>
            </form>
          )}
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
