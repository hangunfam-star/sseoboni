"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatWon } from "@/ui/presentation";
import { TRIAL_HOURS, computeTrialCost, recommendDailyFee, type TrialTerms } from "@/ui/trial-pricing";

export type MyProposal = { id: string; hours: number; offerFee: number; status: string; sellerReply: string | null } | null;

const STATUS_TEXT: Record<string, string> = {
  PENDING: "판매자 답을 기다리는 중이에요",
  ACCEPTED: "판매자가 승인했어요! 써보기 결제·배송이 열리면 이 조건으로 진행돼요",
  DECLINED: "판매자가 이번 제안은 거절했어요",
  CANCELLED: "제안을 취소했어요",
  EXPIRED: "7일 동안 답이 없어 제안이 끝났어요",
};

// param: listingId 상품, price 상품가, terms 판매자 조건(없으면 null), sellerNo 판매자가 '바로 판매만'이면 true, mine 내 최근 제안, onClose 닫기
// return: 써보기 제안 시트(기간·체험비·한마디 → 제안 보내기, 보낸 제안 상태·취소). 결제는 없다.
export function ProposalSheet({ listingId, price, terms, sellerNo, mine, onClose }: {
  listingId: string; price: number; terms: TrialTerms | null; sellerNo: boolean; mine: MyProposal; onClose: () => void;
}) {
  const [current, setCurrent] = useState<MyProposal>(mine);
  const [hours, setHours] = useState<number>(terms?.hours.includes(48) ? 48 : terms?.hours[0] ?? 48);
  const [fee, setFee] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const days = Math.ceil(hours / 24);
  const recommended = recommendDailyFee(price) * days;
  const sellerFee = terms && terms.hours.includes(hours) ? computeTrialCost(price, hours, terms).optionFee : null;
  const showForm = !current || current.status !== "PENDING";

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, textarea, a[href]"));
      if (items.length === 0) return;
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice(null);
    const res = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, hours, offerFee: fee === "" ? NaN : Number(fee), message }),
    });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setNotice({ ok: false, text: res.status === 401 ? "닉네임을 정하고 시작하면 제안할 수 있어요." : d.error ?? "보내지 못했어요." }); return; }
    setCurrent({ id: d.proposal.id, hours: d.proposal.hours, offerFee: d.proposal.offerFee, status: "PENDING", sellerReply: null });
    setNotice({ ok: true, text: "제안을 보냈어요. 판매자가 답하면 MY에서 확인할 수 있어요." });
  }

  async function cancel() {
    if (!current || pending) return;
    setPending(true);
    const res = await fetch(`/api/proposals/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CANCEL" }) });
    setPending(false);
    if (!res.ok) { setNotice({ ok: false, text: "취소하지 못했어요. 이미 답이 왔을 수 있어요." }); return; }
    setCurrent({ ...current, status: "CANCELLED" });
    setNotice(null);
  }

  return (
    <div className="sheet" role="presentation" onClick={onClose}>
      <div ref={panel} className="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="proposal-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2 id="proposal-title">써보기 제안하기</h2>
          <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p className="sheet__lead">
          {sellerNo
            ? "판매자는 바로 판매를 원하지만, 좋은 조건이면 써보게 해 줄 수도 있어요."
            : terms ? "판매자 조건이 맞지 않으면 원하는 기간과 체험비를 제안해 보세요." : "판매자에게 원하는 기간과 체험비를 제안해 보세요."}
          {" "}써보고 사면 체험비는 0원이에요. 결제·배송은 아직 일어나지 않아요.
        </p>

        {current && (
          <div className={`proposal-status proposal-status--${current.status.toLowerCase()}`} role="status">
            <small>내 제안 · {current.hours}시간 · 체험비 {formatWon(current.offerFee)}</small>
            <strong>{STATUS_TEXT[current.status] ?? current.status}</strong>
            {current.sellerReply && <p>판매자: {current.sellerReply}</p>}
            {current.status === "PENDING" && <button type="button" className="text-button" onClick={cancel} disabled={pending}>제안 취소</button>}
          </div>
        )}

        {showForm && (
          <form className="proposal-form" onSubmit={send}>
            <fieldset className="field">
              <legend>써볼 기간</legend>
              <div className="segmented">
                {TRIAL_HOURS.map((h) => <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)}>{h}시간</button>)}
              </div>
            </fieldset>
            <label className="field">
              <span>제안 체험비 <small>({hours}시간 전체 · 사지 않고 돌려보낼 때만 내요)</small></span>
              <div className="price-input">
                <input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^0-9]/g, ""))} placeholder={String(sellerFee ?? recommended)} required />
                <b>원</b>
              </div>
              <small className="field-hint">
                {sellerFee !== null ? `판매자 조건 ${formatWon(sellerFee)} · ` : ""}참고 금액 {formatWon(recommended)}(상품 가격의 약 0.7% × {days}일)
              </small>
            </label>
            <label className="field">
              <span>판매자에게 한마디 <small>(선택)</small></span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={200} placeholder="예: 주말에 영상 편집용으로 써보고 싶어요" />
              <small className="field-hint">전화번호·계좌 같은 연락처는 적지 마세요.</small>
            </label>
            {notice && !notice.ok && <p className="form-error" role="alert">{notice.text}</p>}
            <button className="dark-button" type="submit" disabled={pending}>{pending ? "보내는 중…" : "제안 보내기"}</button>
          </form>
        )}
        {notice?.ok && <p className="form-ok" role="status">{notice.text} <Link href="/me#proposals">MY에서 보기</Link></p>}
      </div>
    </div>
  );
}
