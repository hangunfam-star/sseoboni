"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Gate 0 테스터 로그인 — 실제 인증(휴대폰·본인인증)이 아니라
// 운영자가 테스터별로 발급한 개인 초대 코드로 사용자를 구분합니다. (§78 Gate1/2 승인 전)
const STEPS = [
  { n: "1", title: "고르기", text: "판매자가 올린 중고 제품을 둘러봐요", tone: "navy" },
  { n: "2", title: "써보기", text: "사기 전에 직접 써봐요 · 준비 중", tone: "coral" },
  { n: "3", title: "결정하기", text: "마음에 들면 사고, 아니면 돌려보내요", tone: "yellow" },
];

export default function LoginPage() {
  const [code, setCode] = useState("");
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
      body: JSON.stringify({ code }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "로그인에 실패했습니다.");
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
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="validation-notice">지금은 초대받은 분만 참여하는 테스트 기간이에요. 결제와 배송은 일어나지 않아요.</p>
        <label className="field">
          <span>개인 초대 코드</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: ABCD-EFGH-JK" autoComplete="off" />
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "확인 중…" : "초대 코드로 시작하기"}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </div>
  );
}
