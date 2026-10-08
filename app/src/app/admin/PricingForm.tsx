"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TrialPricing } from "@/ui/trial-pricing";

// param: current 지금 가격안. return: 운영자용 가격안 수정 폼(저장하면 새 version으로 기록)
export function PricingForm({ current }: { current: TrialPricing }) {
  const [hours, setHours] = useState(current.hours.join(","));
  const [rate, setRate] = useState(String(current.dailyRatePct));
  const [dmin, setDmin] = useState(String(current.dailyMin));
  const [dmax, setDmax] = useState(String(current.dailyMax));
  const [ship, setShip] = useState(current.shippingOneWay === null ? "" : String(current.shippingOneWay));
  const [credit, setCredit] = useState(String(current.purchaseCreditPct));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours: hours.split(",").map((h) => Number(h.trim())).filter((h) => !Number.isNaN(h)),
        dailyRatePct: Number(rate), dailyMin: Number(dmin), dailyMax: Number(dmax),
        shippingOneWay: ship.trim() === "" ? null : Number(ship), purchaseCreditPct: Number(credit),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "저장하지 못했어요." }); return; }
    setMsg({ ok: true, text: `저장했어요. 새 가격안: ${d.pricing.version}` });
    router.refresh();
  }

  const field = (label: string, value: string, set: (v: string) => void, hint: string, mode: "numeric" | "decimal" | "text" = "numeric") => (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} inputMode={mode} />
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );

  return (
    <form className="pricing-form" onSubmit={save}>
      {field("써보기 기간(시간, 쉼표로)", hours, setHours, "예: 24,48,72 · 최대 5개", "text")}
      {field("하루 체험비 비율(%)", rate, setRate, "상품 가격 × 이 비율 = 하루 체험비", "decimal")}
      <div className="pricing-form__row">
        {field("하루 최소(원)", dmin, setDmin, "")}
        {field("하루 최대(원)", dmax, setDmax, "")}
      </div>
      {field("편도 배송비(원)", ship, setShip, "비워 두면 구매자 화면에 '확정 전'으로 보여요")}
      {field("구매 시 돌려받는 체험비(%)", credit, setCredit, "0이면 사도 체험비를 그대로 내요(가장 보수적)")}
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} role="status">{msg.text}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "저장 중…" : "가격안 저장"}</button>
    </form>
  );
}
