"use client";
import { useState } from "react";
import type { OrderPhotoStage } from "@/ui/check-items";
import { ORDER_PHOTO_MAX } from "@/ui/check-items";

// param: orderId, stage 단계(RECEIVE·PACK·INSPECT), initial 이미 올린 파일, label 안내, onChange 장수 변화
// return: 거래 단계 증거 사진 올리기(바로 저장, 지우기 가능). 사진은 거래 당사자와 운영자만 본다
export function StagePhotos({ orderId, stage, initial, label, onChange }: { orderId: string; stage: OrderPhotoStage; initial: string[]; label: string; onChange?: (n: number) => void }) {
  const [files, setFiles] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = (f: string) => `/api/orders/${orderId}/photos/${f}`;
  const update = (next: string[]) => { setFiles(next); onChange?.(next.length); };

  async function add(list: FileList | null) {
    if (!list || list.length === 0 || busy) return;
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.append("stage", stage);
    for (const f of Array.from(list)) fd.append("photo", f);
    const res = await fetch(`/api/orders/${orderId}/photos`, { method: "POST", body: fd }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { setError(d?.error ?? "사진을 올리지 못했어요."); if (d?.saved?.length) update([...files, ...d.saved]); return; }
    update([...files, ...d.photos]);
  }
  async function remove(f: string) {
    if (busy) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/orders/${orderId}/photos?stage=${stage}&file=${encodeURIComponent(f)}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError("사진을 지우지 못했어요."); return; }
    update(files.filter((x) => x !== f));
  }

  return (
    <div className="stage-photo-box">
      <strong className="check-row__label">{label}</strong>
      <div className="stage-photos">
        {files.map((f, i) => (
          <span className="stage-photo" key={f}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 거래 당사자 전용 사진 주소 */}
            <img src={url(f)} alt={`${label} ${i + 1}`} />
            <button type="button" className="stage-photo__remove" aria-label={`${label} ${i + 1} 지우기`} onClick={() => void remove(f)} disabled={busy}>×</button>
          </span>
        ))}
        {files.length < ORDER_PHOTO_MAX && (
          <label className="stage-photo-add">
            {busy ? "올리는 중" : "+ 사진"}
            <input type="file" accept="image/*" multiple onChange={(e) => { void add(e.target.files); e.target.value = ""; }} disabled={busy} />
          </label>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

// param: orderId, files, label. return: 올린 증거 사진 보기(읽기 전용)
export function StagePhotoList({ orderId, files, label }: { orderId: string; files: string[]; label: string }) {
  if (files.length === 0) return null;
  return (
    <div className="stage-photos" aria-label={label}>
      {files.map((f, i) => (
        <a key={f} href={`/api/orders/${orderId}/photos/${f}`} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- 거래 당사자 전용 사진 주소 */}
          <img src={`/api/orders/${orderId}/photos/${f}`} alt={`${label} ${i + 1}`} />
        </a>
      ))}
    </div>
  );
}
