"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Gate 0 테스터 시작 화면 — 링크를 받은 누구나 닉네임만 정하면 참여한다.
// 서버가 무작위 계정을 만들어 서명 쿠키로 유지하며, 실명·휴대폰 인증은 Gate 1/2 이후에 구현한다.
const STEPS = [
  { n: "1", title: "고르기", text: "판매자가 올린 중고 제품을 둘러봐요", tone: "navy" },
  { n: "2", title: "써보기", text: "사기 전에 직접 써봐요 · 준비 중", tone: "coral" },
  { n: "3", title: "결정하기", text: "마음에 들면 사고, 아니면 돌려보내요", tone: "yellow" },
];

export default function LoginPage() {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "시작하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="login-page page">
      <p className="wordmark">써보니<span>.</span></p>
      <section className="login-hero">
        <h1>사기 전에, 써보니.</h1>
        <p>중고거래의 새로운 방법. 잘 아는 제품은 바로 사고, 고민되는 제품은 먼저 써보고 결정하세요.</p>
      </section>
      <ol className="login-steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className={`step-dot step-dot--${s.tone}`}>{s.n}</span>
            <div><strong>{s.title}</strong><small>{s.text}</small></div>
          </li>
        ))}
      </ol>
      <section className="try-hero try-hero--login" aria-labelledby="mission-title">
        <span className="try-hero__tag">베타테스터 미션</span>
        <h2 id="mission-title">써보고 싶은 중고에<br /><em>‘써보고 싶어요’</em>를 눌러 주세요</h2>
        <p>여러분이 누른 의견으로 어떤 상품부터 써보기를 열지 정해요. 찾는 물건이 없으면 ‘찾는 상품’으로 남겨 주세요.</p>
      </section>
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="validation-notice">지금은 링크를 받은 누구나 참여할 수 있는 테스트 기간이에요. 결제와 배송은 일어나지 않아요.</p>
        <label className="field">
          <span>닉네임</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="2~12자 (예: 맥북찾는중)" maxLength={12} autoComplete="nickname" />
          <small className="field-hint">화면에 보이는 이름이에요. 같은 이름이 있어도 괜찮아요.</small>
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "시작하는 중…" : "닉네임 정하고 시작하기"}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </div>
  );
}
