"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONDITION_GRADES, conditionLabel, demandLabel } from "@/ui/presentation";
import { SELL_CATEGORIES } from "@/ui/categories";
import { ComponentPicker } from "@/components/ComponentPicker";
import { EMPTY_TERMS, TrialTermsFields, termsPayload, type TermsDraft } from "@/components/TrialTermsFields";

type ProductModel = { id: string; brand: string; modelName: string; seekers: number };

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const CUSTOM = "__custom__"; // 모델 목록에 없을 때 직접 입력

const TRY_OPTIONS = [
  { value: "YES", label: "써보기 허용" },
  { value: "NO", label: "바로 판매만" },
] as const;

export default function NewListingPage() {
  const [models, setModels] = useState<ProductModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customModelName, setCustomModelName] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [conditionGrade, setConditionGrade] = useState("A");
  const [description, setDescription] = useState("");
  const [tryWillingness, setTryWillingness] = useState("");
  const [terms, setTerms] = useState<TermsDraft>(EMPTY_TERMS);
  const [components, setComponents] = useState<string[]>(["본체"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => setModels(d.models ?? []));
  }, []);

  const isCustom = modelId === CUSTOM;
  const selected = models.find((m) => m.id === modelId);
  const label = selected ? demandLabel(selected.seekers) : null;
  const hint = label && `이 모델을 ${label.startsWith("찾는 사람 ") ? `${selected!.seekers}명이 찾고 있어요` : "찾는 사람이 있어요"}`;

  // param: list 고른 파일들. 사진 형식·크기·장수를 확인하고 미리보기를 만든다.
  function addPhotos(list: FileList | null) {
    if (!list) return;
    setError(null);
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (picked.some((f) => f.size > MAX_BYTES)) setError("사진 한 장은 10MB 이하로 골라 주세요.");
    const ok = picked.filter((f) => f.size <= MAX_BYTES).slice(0, MAX_PHOTOS - photos.length);
    if (photos.length + picked.length > MAX_PHOTOS) setError(`사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`);
    setPhotos((prev) => [...prev, ...ok.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  function removePhoto(i: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, k) => k !== i);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: isCustom ? "" : modelId,
        customModel: isCustom ? { brand: customBrand, modelName: customModelName, category: customCategory } : undefined,
        title, price: price.replace(/,/g, ""), conditionGrade, description, tryWillingness, components,
        trialTerms: tryWillingness === "YES" ? termsPayload(terms) : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPending(false);
      setError(res.status === 401 ? "닉네임을 정하고 시작한 뒤 등록할 수 있어요." : data.error ?? "등록에 실패했습니다.");
      return;
    }
    if (photos.length > 0) {
      const form = new FormData();
      photos.forEach((p) => form.append("photo", p.file));
      const up = await fetch(`/api/listings/${data.listing.id}/photos`, { method: "POST", body: form });
      if (!up.ok) {
        const u = await up.json().catch(() => ({}));
        alert(`상품은 등록됐지만 사진을 올리지 못했어요. ${u.error ?? ""}`.trim());
      }
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
          {photos.length < MAX_PHOTOS && (
            <label className="photo-slot photo-slot--add">
              <input className="sr-only" type="file" accept="image/*,.heic,.heif" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              <span>{photos.length}/{MAX_PHOTOS}</span>
              <span className="sr-only">사진 추가</span>
            </label>
          )}
          {photos.map((p, i) => (
            <div key={p.preview} className="photo-slot photo-slot--thumb">
              {/* 업로드 전 미리보기(blob 주소)라 이미지 최적화 대상이 아니다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`고른 사진 ${i + 1}`} />
              {i === 0 && <span className="photo-slot__main">대표</span>}
              <button type="button" className="photo-slot__remove" aria-label={`사진 ${i + 1} 빼기`} onClick={() => removePhoto(i)}>×</button>
            </div>
          ))}
        </div>
        {photos.length === 0 && <p className="field-hint">실제 상품 사진을 올려 주세요. 첫 사진이 대표 사진이 돼요. 사진 속 위치 정보는 저장하지 않아요.</p>}

        <label className="field">
          <span>모델</span>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} required>
            <option value="">모델을 선택하세요</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.modelName}</option>)}
            <option value={CUSTOM}>목록에 없어요 · 직접 입력</option>
          </select>
        </label>
          {hint && <p className="hint-chip">{hint}</p>}

        {isCustom && (
          <>
            <label className="field">
              <span>상품 종류</span>
              <select value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} required>
                <option value="">종류를 선택하세요</option>
                {SELL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <span>브랜드</span>
              <input value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} placeholder="예: 소니, 조이트론, 브랜드 없음" maxLength={30} required />
            </label>
            <label className="field">
              <span>모델명</span>
              <input value={customModelName} onChange={(e) => setCustomModelName(e.target.value)} placeholder="예: MDR-7506" maxLength={60} required />
              <small className="field-hint">같은 모델이 이미 있으면 그 모델로 함께 묶여요.</small>
            </label>
          </>
        )}

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

        <ComponentPicker value={components} onChange={setComponents} />

        <label className="field">
          <span>설명</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="사용 기간, 흠집, 배터리 상태를 적어 주세요" rows={5} maxLength={2000} required />
        </label>

        <fieldset className="try-question">
          <legend>구매자가 사기 전에 써보게 할까요?</legend>
          <small>써보기 결제·배송은 아직 열리지 않았어요. &apos;바로 판매만&apos;이어도 구매자가 써보기 조건을 제안할 수 있어요.</small>
          <div className="try-question__options">
            {TRY_OPTIONS.map((o) => (
              <button key={o.value} type="button" aria-pressed={tryWillingness === o.value} onClick={() => setTryWillingness(o.value)}>{o.label}</button>
            ))}
          </div>
          {tryWillingness === "YES" && <TrialTermsFields value={terms} onChange={setTerms} price={Number(price) || 0} />}
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="dark-button" type="submit" disabled={pending}>{pending ? "등록 중…" : "등록하기"}</button>
      </form>
    </div>
  );
}
