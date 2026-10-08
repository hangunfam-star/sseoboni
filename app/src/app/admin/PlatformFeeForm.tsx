"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeePromo, PlatformFeeConfig } from "@/ui/platform-fee";

type Row = { start: string; end: string; pct: string; label: string };

// param: current 지금 수수료 설정. return: 기본 수수료와 특정 기간(예: 0%) 편집 폼
export function PlatformFeeForm({ current }: { current: PlatformFeeConfig }) {
  const [defaultPct, setDefaultPct] = useState(String(current.defaultPct));
  const [rows, setRows] = useState<Row[]>(current.promos.map((p: FeePromo) => ({ start: p.start, end: p.end, pct: String(p.pct), label: p.label })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/admin/platform-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultPct: Number(defaultPct), promos: rows.map((r) => ({ start: r.start, end: r.end, pct: Number(r.pct), label: r.label })) }),
    });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "저장하지 못했어요." }); return; }
    setMsg({ ok: true, text: "저장했어요." });
    router.refresh();
  }

  return (
    <form className="pricing-form" onSubmit={save}>
      <label className="field">
        <span>기본 수수료(%)</span>
        <input value={defaultPct} onChange={(e) => setDefaultPct(e.target.value)} inputMode="decimal" />
        <small className="field-hint">미리 결제한 금액(상품 가격)에 붙어요. 사도·돌려보내도 받아요.</small>
      </label>
      <p className="field-hint">특정 기간(한국 날짜, 시작·끝 포함)에는 다른 수수료를 적용해요. 예: 오픈 기념 0%</p>
      {rows.map((r, i) => (
        <div key={i} className="fee-promo">
          <input type="date" value={r.start} onChange={(e) => setRow(i, { start: e.target.value })} aria-label={`기간 ${i + 1} 시작`} />
          <input type="date" value={r.end} onChange={(e) => setRow(i, { end: e.target.value })} aria-label={`기간 ${i + 1} 끝`} />
          <input value={r.pct} onChange={(e) => setRow(i, { pct: e.target.value })} inputMode="decimal" aria-label={`기간 ${i + 1} 수수료(%)`} placeholder="%" />
          <input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} maxLength={30} aria-label={`기간 ${i + 1} 이름`} placeholder="이름(예: 오픈 기념)" />
          <button type="button" className="text-button" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}>삭제</button>
        </div>
      ))}
      <button type="button" className="secondary-button" onClick={() => setRows((rs) => [...rs, { start: "", end: "", pct: "0", label: "" }])}>특정 기간 추가</button>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} role="status">{msg.text}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "저장 중…" : "수수료 저장"}</button>
    </form>
  );
}
