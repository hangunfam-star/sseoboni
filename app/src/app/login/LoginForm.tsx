"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KakaoButton } from "@/components/KakaoButton";

// 시작 화면 — 카카오로 로그인(2026-10-14부터 닉네임만으로 시작하기는 없앰). 처음 온 사람은 카카오 확인 뒤 닉네임을 정한다.
const STEPS = [
  { n: "1", title: "고르기", text: "판매자가 올린 중고 제품을 둘러봐요", tone: "navy" },
  { n: "2", title: "써보기", text: "사기 전에 직접 써봐요 · 준비 중", tone: "coral" },
  { n: "3", title: "결정하기", text: "마음에 들면 사고, 아니면 돌려보내요", tone: "yellow" },
];

// param: kakaoOn 카카오 키 설정 여부, kakaoStep 카카오 확인을 마치고 닉네임만 남은 상태, kakaoNickname 카카오 닉네임(동의·규칙 맞을 때만), message 안내 문구, next 로그인 후 갈 경로
export function LoginForm({ kakaoOn, kakaoStep, kakaoNickname, message, next }: { kakaoOn: boolean; kakaoStep: boolean; kakaoNickname: string | null; message: string | null; next: string }) {
  const [nickname, setNickname] = useState("");
  const [useKakao, setUseKakao] = useState<boolean>(Boolean(kakaoNickname));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const res = await fetch("/api/auth/kakao/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(useKakao && kakaoNickname ? { useKakao: true } : { nickname }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "시작하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    router.push(next);
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
      {message && <p className={kakaoStep ? "login-message" : "login-message login-message--warn"} role="status">{message}</p>}
      {kakaoStep ? (
        <form className="login-card" onSubmit={handleSubmit}>
          <p className="validation-notice">카카오 로그인을 마쳤어요. 써보니에서 쓸 닉네임을 정해 주세요. 닉네임은 나중에 MY에서 바꿀 수 있어요.</p>
          {kakaoNickname && (
            <fieldset className="nick-choice">
              <legend className="sr-only">닉네임 고르기</legend>
              <label className={useKakao ? "nick-choice__item is-on" : "nick-choice__item"}>
                <input type="radio" name="nick-mode" checked={useKakao} onChange={() => setUseKakao(true)} />
                <span><strong>카카오 닉네임 그대로 쓰기</strong><small>{kakaoNickname}</small></span>
              </label>
              <label className={!useKakao ? "nick-choice__item is-on" : "nick-choice__item"}>
                <input type="radio" name="nick-mode" checked={!useKakao} onChange={() => setUseKakao(false)} />
                <span><strong>써보니 닉네임 새로 만들기</strong><small>다른 이름으로 활동해요</small></span>
              </label>
            </fieldset>
          )}
          {(!kakaoNickname || !useKakao) && (
            <label className="field">
              <span>써보니 닉네임</span>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="2~12자 (예: 맥북찾는중)" maxLength={12} autoComplete="nickname" autoFocus />
              <small className="field-hint">화면에 보이는 이름이에요. 같은 이름이 있어도 괜찮아요.</small>
            </label>
          )}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "시작하는 중…" : useKakao && kakaoNickname ? "카카오 닉네임으로 시작하기" : "이 닉네임으로 시작하기"}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      ) : (
        <div className="login-card">
          {kakaoOn
            ? <KakaoButton href={`/api/auth/kakao/start?mode=login&next=${encodeURIComponent(next)}`} label="카카오로 로그인" />
            : <p className="form-error">카카오 로그인을 준비하고 있어요. 잠시 후 다시 시도해 주세요.</p>}
          <p className="validation-notice">처음이면 카카오 로그인 뒤 닉네임만 정하면 바로 시작해요. 카카오에서는 회원번호와, 동의하면 닉네임만 받아요. 이름·연락처는 받지 않아요. 지금은 테스트 기간이라 결제와 배송은 일어나지 않아요.</p>
          <p className="field-hint">예전에 닉네임으로 쓰던 계정이 있나요? 그 계정에 카카오를 연결했다면 카카오로 로그인하면 그대로 이어져요. 연결하지 않았다면 운영자에게 복구 링크를 요청해 주세요.</p>
        </div>
      )}
    </div>
  );
}
