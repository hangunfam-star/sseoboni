"use client";
import { useEffect, useState } from "react";

type ProductModel = { id: string; brand: string; modelName: string };
type DemandRow = {
  id: string; intentType: string; brand: string; modelName: string;
  desiredPriceMin: number | null; desiredPriceMax: number | null; createdAt: string;
};

const INTENT_LABEL: Record<string, string> = {
  LOOKING_TO_BUY: "구매하고 싶어요",
  WANT_TO_TRY: "써보고 싶어요",
  PAID_TRY_INTENT: "비용 내고 써볼 의향 있어요",
};

export default function DemandPage() {
  const [models, setModels] = useState<ProductModel[]>([]);
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [intentType, setIntentType] = useState("LOOKING_TO_BUY");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [error, setError] = useState<string | null>(null);

  function loadDemand() {
    fetch("/api/demand-intents").then((r) => r.json()).then((d) => setRows(d.demandIntents ?? []));
  }

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => setModels(d.models ?? []));
    loadDemand();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/demand-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, intentType, desiredPriceMin: priceMin, desiredPriceMax: priceMax }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "등록에 실패했습니다.");
      return;
    }
    setModelId(""); setPriceMin(""); setPriceMax("");
    loadDemand();
  }

  return (
    <div>
      <h1>찾는 상품 등록</h1>
      <p style={{ color: "#888", fontSize: 14 }}>원하는 모델과 조건을 등록해두면, 매물이 올라왔을 때 참고 데이터로 쓰입니다.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} required>
          <option value="">모델 선택</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.brand} · {m.modelName}</option>)}
        </select>
        <select value={intentType} onChange={(e) => setIntentType(e.target.value)}>
          {Object.entries(INTENT_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="희망가격 최소" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} style={{ flex: 1 }} />
          <input placeholder="희망가격 최대" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} style={{ flex: 1 }} />
        </div>
        <button type="submit" style={{ padding: "10px 16px" }}>등록</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <h2 style={{ marginTop: 32 }}>등록된 수요</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 13, color: "#888" }}>{r.brand} · {r.modelName}</div>
            <div>{INTENT_LABEL[r.intentType]}{r.desiredPriceMin ? ` · ${r.desiredPriceMin.toLocaleString()}~${r.desiredPriceMax?.toLocaleString()}원` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
