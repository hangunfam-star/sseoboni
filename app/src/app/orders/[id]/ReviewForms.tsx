"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_SAMPLES, chipsFor } from "@/ui/trade-rules";

// 거래 평가: 별점 1~10, 정해진 문구(필수) + 예시 문장·직접 쓰기(선택). 구매자는 설명·구성품 일치도 고른다.
export function TradeReviewForm({ orderId, direction, targetName }: { orderId: string; direction: "B2S" | "S2B"; targetName: string }) {
  const router = useRouter();
  const [stars, setStars] = useState<number | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [sample, setSample] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [descMatch, setDescMatch] = useState<boolean | null>(null);
  const [compMatch, setCompMatch] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = stars ? chipsFor(direction, stars) : [];

  function pickStars(n: number) {
    setStars(n);
    setChips((cur) => cur.filter((c) => chipsFor(direction, n).includes(c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "TRADE", stars, chips, sample, body, descMatch, compMatch }),
    });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(d.error ?? "남기지 못했어요."); return; }
    router.refresh();
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <strong>{targetName}님과의 거래는 어땠나요?</strong>
      <fieldset className="review-stars">
        <legend>별점 <small>(필수, 1~10)</small></legend>
        <div>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} type="button" aria-pressed={stars === n} aria-label={`${n}점`} onClick={() => pickStars(n)}>{n}</button>)}</div>
      </fieldset>
      {stars !== null && (
        <fieldset>
          <legend>어떤 점이 {stars >= 7 ? "좋았나요" : stars <= 4 ? "아쉬웠나요" : "기억에 남나요"}? <small>(필수, 여러 개)</small></legend>
          <div className="component-picker__chips">{options.map((c) => <button key={c} type="button" className="chip" aria-pressed={chips.includes(c)} onClick={() => setChips(chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c])}>{c}</button>)}</div>
        </fieldset>
      )}
      {direction === "B2S" && (
        <div className="review-yesno">
          <span>설명과 실제 상태가 같았나요?</span>
          <div className="segmented"><button type="button" aria-pressed={descMatch === true} onClick={() => setDescMatch(true)}>같았어요</button><button type="button" aria-pressed={descMatch === false} onClick={() => setDescMatch(false)}>달랐어요</button></div>
          <span>구성품 안내가 맞았나요?</span>
          <div className="segmented"><button type="button" aria-pressed={compMatch === true} onClick={() => setCompMatch(true)}>맞았어요</button><button type="button" aria-pressed={compMatch === false} onClick={() => setCompMatch(false)}>달랐어요</button></div>
        </div>
      )}
      <fieldset>
        <legend>예시 문장 <small>(선택)</small></legend>
        <div className="component-picker__chips">{REVIEW_SAMPLES[direction].map((t) => <button key={t} type="button" className="chip" aria-pressed={sample === t} onClick={() => setSample(sample === t ? null : t)}>{t}</button>)}</div>
      </fieldset>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={300} placeholder="직접 쓰기 (선택)" aria-label="후기 직접 쓰기" />
      <small className="field-hint">상대도 평가를 남기거나 7일이 지나면 함께 공개돼요. 후기에는 보상이 없어요.</small>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="dark-button" type="submit" disabled={pending || stars === null || chips.length === 0 || (direction === "B2S" && (descMatch === null || compMatch === null))}>평가 남기기</button>
    </form>
  );
}

// 써보니 후기: 체험 전에 고른 질문의 답, 결정 이유, 써보고 알게 된 점, 어울리는 사람
export function TrialReviewForm({ orderId, questions, outcome }: { orderId: string; questions: string[]; outcome: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [learned, setLearned] = useState("");
  const [fitFor, setFitFor] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "TRIAL", answers: Object.entries(answers).map(([q, a]) => ({ q, a })), reason, learned, fitFor }),
    });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(d.error ?? "남기지 못했어요."); return; }
    router.refresh();
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <strong>써보니 후기 <small>({outcome === "PURCHASED" ? "써보고 샀어요" : "써보고 돌려보냈어요"})</small></strong>
      {questions.map((q) => (
        <label key={q} className="field"><span>써보기 전 궁금했던 점: {q}</span>
          <input value={answers[q] ?? ""} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} maxLength={100} placeholder="써보니 어땠나요?" />
        </label>
      ))}
      <label className="field"><span>{outcome === "PURCHASED" ? "산" : "돌려보낸"} 이유 <small>(선택)</small></span><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} /></label>
      <label className="field"><span>써보고 알게 된 점 한 줄</span><input value={learned} onChange={(e) => setLearned(e.target.value)} maxLength={60} placeholder="예: 배터리가 하루를 버텨요" /></label>
      <label className="field"><span>이런 분께 어울려요 <small>(선택)</small></span><input value={fitFor} onChange={(e) => setFitFor(e.target.value)} maxLength={60} placeholder="예: 발볼이 넓은 분" /></label>
      <small className="field-hint">같은 모델을 보는 사람들에게 &apos;이 모델 써본 사람들의 한마디&apos;로 보여요. 개인에게 안 맞아 돌려보낸 것은 판매자 잘못으로 보지 않아요.</small>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="dark-button" type="submit" disabled={pending}>써보니 후기 남기기</button>
    </form>
  );
}
