"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONDITION_GRADES, conditionLabel, demandLabel } from "@/ui/presentation";

type ProductModel = { id: string; brand: string; modelName: string; seekers: number };

const TRY_OPTIONS = [
  { value: "YES", label: "괜찮아요" },
  { value: "CONDITIONAL", label: "조건 따라" },
  { value: "NO", label: "아니요" },
] as const;

export default function NewListingPage() {
  const [models, setModels] = useState<ProductModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [conditionGrade, setConditionGrade] = useState("A");
  const [description, setDescription] = useState("");
  const [tryWillingness, setTryWillingness] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => setModels(d.models ?? []));
  }, []);

  const selected = models.find((m) => m.id === modelId);
  const label = selected ? demandLabel(selected.seekers) : null;
  const hint = label && `이 모델을 ${label.startsWith("찾는 사람 ") ? `${selected!.seekers}명이 찾고 있어요` : "찾는 사람이 있어요"}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, title, price: price.replace(/,/g, ""), conditionGrade, description, tryWillingness }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(res.status === 401 ? "초대 코드로 로그인한 뒤 등록할 수 있어요." : data.error ?? "등록에 실패했습니다.");
      return;
    }
    router.push(`/listings/${data.listing.id}`);
  }

  return (
    <div className="page sell-page">
      <div className="page-top">
        <Link className="icon-button" href="/" aria-label="닫기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></Link>
      </div>
      <h1 className="page-title">내 물건 팔기</h1>
      <form className="sell-form" onSubmit={handleSubmit}>
        <div className="photo-slots">
          <div className="photo-slot photo-slot--add" aria-disabled="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
            <span>0/5</span>
          </div>
          <p>사진 올리기는 준비 중이에요. 지금은 모델 일러스트로 보여요.</p>
        </div>

        <label className="field">
          <span>모델</span>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} required>
            <option value="">모델을 선택하세요</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.modelName}</option>)}
          </select>
        </label>
          {hint && <p className="hint-chip">{hint}</p>}

        <label className="field">
          <span>제목</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 맥북 에어 M2 16GB 512GB 풀박스" maxLength={60} required />
        </label>

        <label className="field">
          <span>가격</span>
          <div className="price-input">
            <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" required />
            <b>원</b>
          </div>
        </label>

        <fieldset className="field">
          <legend>상태</legend>
          <div className="grade-picker">
            {CONDITION_GRADES.map((g) => (
              <button key={g} type="button" aria-pressed={conditionGrade === g} onClick={() => setConditionGrade(g)}>{conditionLabel(g)}</button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>설명</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="사용 기간, 흠집, 배터리 상태, 구성품을 적어 주세요" rows={5} maxLength={2000} required />
        </label>

        <fieldset className="try-question">
          <legend>구매자가 먼저 써봐도 괜찮으세요?</legend>
          <small>답만 기록해요. 써보기는 아직 열리지 않았어요.</small>
          <div className="try-question__options">
            {TRY_OPTIONS.map((o) => (
              <button key={o.value} type="button" aria-pressed={tryWillingness === o.value} onClick={() => setTryWillingness(o.value)}>{o.label}</button>
            ))}
          </div>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="dark-button" type="submit" disabled={pending}>{pending ? "등록 중…" : "등록하기"}</button>
      </form>
    </div>
  );
}
