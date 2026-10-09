"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { FEEDBACK_MESSAGE_MAX, FEEDBACK_REASONS, TRY_LATER } from "@/ui/feedback";

// 의견 보내기 — 베타테스터의 망설인 이유와 써보기 의향을 받는다.
export default function FeedbackPage() {
  const [reason, setReason] = useState("");
  const [tryLater, setTryLater] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!reason) { setResult({ ok: false, text: "이유를 하나 골라 주세요." }); return; }
    setPending(true);
    setResult(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, tryLater, message }),
    });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setResult({ ok: false, text: res.status === 401 ? "닉네임을 정하고 시작한 뒤 남길 수 있어요." : d.error ?? "보내지 못했어요." });
      return;
    }
    setResult({ ok: true, text: "의견을 받았어요. 고맙습니다!" });
    setReason("");
    setTryLater("");
    setMessage("");
  }

  return (
    <div className="page feedback-page">
      <div className="page-top">
        <Link className="icon-button" href="/" aria-label="닫기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></Link>
      </div>
      <h1 className="page-title"><Icon name="chat" />의견 보내기</h1>
      <p className="page-lead">써보니를 쓰다가 망설인 이유를 알려 주세요. 써보기를 어떻게 열지 정하는 데 써요. 연락처는 받지 않아요.</p>
      <form className="sell-form" onSubmit={handleSubmit}>
        <fieldset className="field">
          <legend>오늘 구매나 써보기를 망설인 이유는?</legend>
          <div className="feedback-options">
            {FEEDBACK_REASONS.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>써보기가 열리면 써볼 생각이 있나요? <small>(선택)</small></legend>
          <div className="segmented">
            {TRY_LATER.map((t) => (
              <button key={t} type="button" aria-pressed={tryLater === t} onClick={() => setTryLater(tryLater === t ? "" : t)}>{t}</button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>하고 싶은 말 <small>(선택)</small></span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={FEEDBACK_MESSAGE_MAX} placeholder="예: 써보기 기간은 3일이면 충분할 것 같아요" />
        </label>
        {result && <p className={result.ok ? "form-ok" : "form-error"} role="status">{result.text}</p>}
        <button className="dark-button" type="submit" disabled={pending}>{pending ? "보내는 중…" : "의견 보내기"}</button>
      </form>
    </div>
  );
}
