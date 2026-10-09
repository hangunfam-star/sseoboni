"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentPicker } from "@/components/ComponentPicker";
import { EMPTY_TERMS, TrialTermsFields, termsPayload, type TermsDraft } from "@/components/TrialTermsFields";
import { photoUrl } from "@/lib/photo-url";
import { priceProblem } from "@/ui/listing-price";
import { CONDITION_GRADES, conditionLabel } from "@/ui/presentation";

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const TRY_OPTIONS = [
  { value: "YES", label: "써보기 허용" },
  { value: "NO", label: "바로 판매만" },
] as const;

type Loaded = {
  listing: { title: string; price: number; conditionGrade: string; description: string; sellerId: string };
  model: { brand: string; modelName: string } | null;
  components: { name: string }[];
  photos: { fileName: string }[];
};

// 판매자 본인 상품 수정 — 제목·가격·상태·설명·구성품·써보기 의향·사진(추가/삭제)
export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [conditionGrade, setConditionGrade] = useState("A");
  const [description, setDescription] = useState("");
  const [components, setComponents] = useState<string[]>([]);
  const [tryWillingness, setTryWillingness] = useState("");
  const [savedTry, setSavedTry] = useState("");
  const [terms, setTerms] = useState<TermsDraft>(EMPTY_TERMS);
  const [feePct, setFeePct] = useState(3);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/platform-fee").then((r) => r.json()).then((d) => { if (typeof d.pct === "number") setFeePct(d.pct); }).catch(() => undefined);
    fetch(`/api/listings/${id}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setLoadError(d.error ?? "상품을 불러오지 못했어요."); return; }
      if (!d.isOwner) { setLoadError("내가 올린 상품만 고칠 수 있어요."); return; }
      setLoaded(d);
      setTitle(d.listing.title);
      setPrice(String(d.listing.price));
      setConditionGrade(d.listing.conditionGrade);
      setDescription(d.listing.description);
      setComponents(d.components.map((c: { name: string }) => c.name));
      setPhotos(d.photos.map((p: { fileName: string }) => p.fileName));
      setTryWillingness(d.tryWillingness ?? "");
      setSavedTry(d.tryWillingness ?? "");
      if (d.trialTerms) {
        const tiers: { hours: number; fee: number }[] = d.trialTerms.tiers;
        setTerms({
          hours: tiers.map((t) => t.hours), fees: Object.fromEntries(tiers.map((t) => [t.hours, String(t.fee)])),
          shippingOneWay: d.trialTerms.shippingOneWay === null ? "" : String(d.trialTerms.shippingOneWay), conditionNote: d.trialTerms.conditionNote ?? "",
        });
      }
    });
  }, [id]);

  async function addPhotos(list: FileList | null) {
    if (!list || busy) return;
    const files = Array.from(list);
    setError(null);
    if (files.some((f) => f.size > MAX_BYTES)) { setError("사진 한 장은 10MB 이하로 골라 주세요."); return; }
    if (photos.length + files.length > MAX_PHOTOS) { setError(`사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`); return; }
    setBusy(true);
    const form = new FormData();
    files.forEach((f) => form.append("photo", f));
    const res = await fetch(`/api/listings/${id}/photos`, { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    // 일부만 저장됐을 수도 있으니 서버의 사진 목록으로 다시 맞춘다
    const latest = await fetch(`/api/listings/${id}`).then((r) => r.json()).catch(() => null);
    if (latest?.photos) setPhotos(latest.photos.map((p: { fileName: string }) => p.fileName));
    setBusy(false);
    if (!res.ok) setError(d.error ?? "사진을 올리지 못했어요.");
  }

  async function removePhoto(fileName: string) {
    if (busy || !confirm("이 사진을 지울까요? 지운 사진은 되돌릴 수 없어요.")) return;
    setBusy(true);
    const res = await fetch(`/api/listings/${id}/photos?file=${encodeURIComponent(fileName)}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { setError("사진을 지우지 못했어요."); return; }
    setPhotos((prev) => prev.filter((p) => p !== fileName));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (priceProblem(price)) { setError(priceProblem(price)); return; }
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, price, conditionGrade, description, components,
        ...(tryWillingness && tryWillingness !== savedTry ? { tryWillingness } : {}),
        ...(tryWillingness === "YES" ? { trialTerms: termsPayload(terms) } : {}),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "저장하지 못했어요."); return; }
    router.push(`/listings/${id}`);
    router.refresh();
  }

  // 상품 삭제: 목록·검색·내 상품에서 사라지고 되돌릴 수 없다(거래 중이면 서버가 막는다)
  async function removeListing() {
    if (busy || !confirm("이 상품을 삭제할까요? 목록·검색·내 상품에서 사라지고 되돌릴 수 없어요.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REMOVED" }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "삭제하지 못했어요."); return; }
    router.push("/me");
    router.refresh();
  }

  if (loadError) {
    return (
      <div className="page sell-page">
        <div className="empty-card"><strong>{loadError}</strong><Link href="/me">내 상품으로 가기</Link></div>
      </div>
    );
  }
  if (!loaded) return <div className="page sell-page"><p className="page-lead">불러오는 중…</p></div>;

  return (
    <div className="page sell-page">
      <div className="page-top">
        <Link className="icon-button" href={`/listings/${id}`} aria-label="닫기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></Link>
      </div>
      <h1 className="page-title">상품 수정</h1>
      <p className="page-lead">{[loaded.model?.brand, loaded.model?.modelName].filter(Boolean).join(" ")}</p>
      <form className="sell-form" onSubmit={handleSubmit}>
        <div className="photo-slots">
          {photos.length < MAX_PHOTOS && (
            <label className="photo-slot photo-slot--add">
              <input className="sr-only" type="file" accept="image/*,.heic,.heif" multiple disabled={busy} onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              <span>{photos.length}/{MAX_PHOTOS}</span>
              <span className="sr-only">사진 추가</span>
            </label>
          )}
          {photos.map((name, i) => (
            <div key={name} className="photo-slot photo-slot--thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(name)} alt={`상품 사진 ${i + 1}`} />
              {i === 0 && <span className="photo-slot__main">대표</span>}
              <button type="button" className="photo-slot__remove" aria-label={`사진 ${i + 1} 지우기`} onClick={() => void removePhoto(name)} disabled={busy}>×</button>
            </div>
          ))}
        </div>
        <p className="field-hint">사진은 고르는 즉시 올라가고, ×를 누르면 바로 지워져요.</p>

        <label className="field">
          <span>제목</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
        </label>
        <label className="field">
          <span>가격</span>
          <div className="price-input">
            <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} required />
            <b>원</b>
          </div>
          {priceProblem(price) ? <small className="form-error" role="alert">{priceProblem(price)}</small> : <small className="field-hint">1,000원 이상만 올릴 수 있어요.</small>}
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
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={2000} required />
        </label>
        <fieldset className="try-question">
          <legend>구매자가 사기 전에 써보게 할까요?</legend>
          <small>지금 저장된 답이 선택돼 있어요. &apos;바로 판매만&apos;이어도 구매자 제안은 받아요.</small>
          <div className="try-question__options">
            {TRY_OPTIONS.map((o) => (
              <button key={o.value} type="button" aria-pressed={tryWillingness === o.value} onClick={() => setTryWillingness(o.value)}>{o.label}</button>
            ))}
          </div>
          {tryWillingness === "YES" && <TrialTermsFields value={terms} onChange={setTerms} price={Number(price) || 0} feePct={feePct} />}
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="dark-button" type="submit" disabled={busy || priceProblem(price) !== null}>{busy ? "저장 중…" : "저장하기"}</button>
        <button className="text-button listing-delete" type="button" onClick={() => void removeListing()} disabled={busy}>상품 삭제</button>
      </form>
    </div>
  );
}
