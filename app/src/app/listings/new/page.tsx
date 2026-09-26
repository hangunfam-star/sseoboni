"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProductModel = { id: string; brand: string; modelName: string };

export default function NewListingPage() {
  const [models, setModels] = useState<ProductModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [conditionGrade, setConditionGrade] = useState("A");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, title, price, conditionGrade, description }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "등록에 실패했습니다.");
      return;
    }
    router.push(`/listings/${data.listing.id}`);
  }

  return (
    <div>
      <h1>상품 등록</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} required>
          <option value="">모델 선택</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.brand} · {m.modelName}</option>
          ))}
        </select>
        <input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input placeholder="가격(원)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <select value={conditionGrade} onChange={(e) => setConditionGrade(e.target.value)}>
          <option value="S">S (미개봉/최상)</option>
          <option value="A">A (사용감 적음)</option>
          <option value="B">B (사용감 있음)</option>
          <option value="C">C (하자 있음)</option>
        </select>
        <textarea
          placeholder="상세 설명 (사용 기간, 하자 여부 등)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          required
        />
        <button type="submit" style={{ padding: "10px 16px" }}>등록하기</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
