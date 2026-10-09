"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TradeSettings } from "@/ui/trade-rules";

const LABELS: [keyof TradeSettings, string][] = [
  ["paymentWaitHours", "입금 기한(시간)"], ["shipPromiseDays", "발송 약속(일)"], ["autoReceiveDays", "자동 받음 처리(일)"],
  ["decisionGraceHours", "체험 뒤 답 기다림(시간)"], ["buyAutoConfirmDays", "바로 구매 자동 확정(일)"], ["returnShipDays", "반송 약속(일)"],
  ["inspectDays", "검수 기한(일)"], ["refundDays", "환불 기한(일)"], ["reviewWindowDays", "후기 작성 기간(일)"], ["reviewRevealDays", "후기 공개(일)"],
  ["statsMinCount", "시세 최소 거래 수"], ["statsDays", "집계 기간(일)"],
];

// 운영자: 거래 설정(거래 열기·기한)
export function TradeSettingsForm({ current }: { current: TradeSettings }) {
  const router = useRouter();
  const [s, setS] = useState<TradeSettings>(current);
  const [grade, setGrade] = useState(current.gradeSteps.join(","));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (s.tradeOpen && !current.tradeOpen && !confirm("거래를 열면 구매자가 판매자 계좌로 실제 돈을 보내는 신청을 할 수 있어요. 열까요?")) return;
    setPending(true);
    setMsg(null);
    const settings = { ...s, gradeSteps: grade.split(",").map((x) => Number(x.trim())) };
    const res = await fetch("/api/admin/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "SETTINGS", settings }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "저장하지 못했어요." }); return; }
    setMsg({ ok: true, text: "저장했어요." });
    router.refresh();
  }

  return (
    <form className="pricing-form trade-settings" onSubmit={save}>
      <label className="order-inline trade-open"><input type="checkbox" checked={s.tradeOpen} onChange={(e) => setS({ ...s, tradeOpen: e.target.checked })} /> <b>거래 열기</b> <small>(끄면 구매·써보기 신청을 받지 않아요. 진행 중 거래는 계속돼요)</small></label>
      <div className="trade-settings__grid">
        {LABELS.map(([k, label]) => (
          <label key={k} className="field"><span>{label}</span>
            <input inputMode="numeric" value={String(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value.replace(/[^\d]/g, "") || 0) })} />
          </label>
        ))}
        <label className="field"><span>등급 경계(경험치, 쉼표)</span><input value={grade} onChange={(e) => setGrade(e.target.value)} /></label>
        <label className="field"><span>정식 수수료율(%) 기록용</span><input inputMode="decimal" value={String(s.formalFeePct)} onChange={(e) => setS({ ...s, formalFeePct: Number(e.target.value) || 0 })} /></label>
      </div>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <button className="dark-button" type="submit" disabled={pending}>설정 저장</button>
    </form>
  );
}

// 운영자: 분쟁 정리(처리 결과, 구매자 책임 확인 여부, 필요하면 환불액 조정)
export function ResolveDisputeForm({ disputeId, maxRefund }: { disputeId: string; maxRefund: number }) {
  const router = useRouter();
  const [resolution, setResolution] = useState("");
  const [buyerFault, setBuyerFault] = useState(false);
  const [amount, setAmount] = useState("");
  const [outcome, setOutcome] = useState<"CONTINUE" | "REFUND" | "PURCHASE">("CONTINUE");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/admin/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "RESOLVE", disputeId, resolution, buyerFault, outcome, refundAmount: amount === "" ? undefined : Number(amount) }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setMsg(d.error ?? "처리하지 못했어요."); return; }
    router.refresh();
  }
  return (
    <form className="order-form" onSubmit={save}>
      <input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="처리 결과(양쪽에 보여요)" aria-label="처리 결과" maxLength={500} required />
      <select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} aria-label="분쟁 결과">
        <option value="CONTINUE">거래 계속 진행</option>
        <option value="REFUND">환불로 끝내기(금액 입력)</option>
        <option value="PURCHASE">구매로 확정</option>
      </select>
      <label className="order-inline"><input type="checkbox" checked={buyerFault} onChange={(e) => setBuyerFault(e.target.checked)} /> 구매자 책임(훼손 등)이 확인됨</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder={outcome === "REFUND" ? `돌려줄 금액(필수, 0~${maxRefund.toLocaleString("ko-KR")})` : `환불액 조정(선택, 0~${maxRefund.toLocaleString("ko-KR")})`} aria-label="환불액 조정" />
      {msg && <p className="form-error" role="alert">{msg}</p>}
      <button className="secondary-button" type="submit" disabled={pending}>분쟁 정리</button>
    </form>
  );
}
