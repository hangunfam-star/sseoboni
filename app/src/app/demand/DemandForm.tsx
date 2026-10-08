"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const INTENTS = [
  { value: "LOOKING_TO_BUY", label: "바로 사고 싶어요" },
  { value: "WANT_TO_TRY", label: "써보고 싶어요" },
  { value: "PAID_TRY_INTENT", label: "비용 내고라도 써볼래요" },
] as const;

export function DemandForm({ models, initialModelId }: { models: { id: string; label: string }[]; initialModelId: string }) {
  const [modelId, setModelId] = useState(models.some((m) => m.id === initialModelId) ? initialModelId : "");
  const [intentType, setIntentType] = useState<string>("LOOKING_TO_BUY");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    const res = await fetch("/api/demand-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, intentType, desiredPriceMin: priceMin, desiredPriceMax: priceMax }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setMessage({ ok: false, text: res.status === 401 ? "닉네임을 정하고 시작한 뒤 남길 수 있어요." : data.error ?? "등록에 실패했습니다." });
      return;
    }
    setMessage({ ok: true, text: data.updated ? "같은 요청이 있어 조건을 고쳤어요." : "찾는 상품을 남겼어요." });
    setPriceMin("");
    setPriceMax("");
    router.refresh();
  }

  const digits = (v: string) => v.replace(/[^0-9]/g, "");

  return (
    <form className="demand-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>모델</span>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} required>
          <option value="">모델을 선택하세요</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      <fieldset className="field">
        <legend>목적</legend>
        <div className="segmented">
          {INTENTS.map((o) => (
            <button key={o.value} type="button" aria-pressed={intentType === o.value} onClick={() => setIntentType(o.value)}>{o.label}</button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <span>희망 가격 (선택)</span>
        <div className="price-range">
          <input aria-label="최소 가격" inputMode="numeric" placeholder="최소" value={priceMin} onChange={(e) => setPriceMin(digits(e.target.value))} />
          <span aria-hidden="true">~</span>
          <input aria-label="최대 가격" inputMode="numeric" placeholder="최대" value={priceMax} onChange={(e) => setPriceMax(digits(e.target.value))} />
          <b>원</b>
        </div>
      </div>
      {message && <p className={message.ok ? "form-ok" : "form-error"} role="status">{message.text}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "남기는 중…" : "찾는 상품 남기기"}</button>
    </form>
  );
}
