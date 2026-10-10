import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { KakaoButton } from "@/components/KakaoButton";
import { getCurrentUserId } from "@/lib/session";
import { hasKakao, KAKAO_MESSAGES, kakaoConfigured } from "@/lib/kakao";
import { KakaoUnlinkButton } from "./KakaoUnlinkButton";

export const metadata: Metadata = { title: "로그인 연결 · 써보니", robots: { index: false, follow: false } };

// 로그인 연결 — 지금 계정에 카카오를 연결하면 로그아웃하거나 다른 기기에서도 카카오로 같은 계정에 들어온다
export default async function LoginLinkPage({ searchParams }: { searchParams: Promise<{ kakao?: string }> }) {
  const { kakao } = await searchParams;
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><h1 className="page-title"><Icon name="shield" />로그인 연결</h1><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  const linked = hasKakao(userId);
  const on = kakaoConfigured();
  const message = kakao ? KAKAO_MESSAGES[kakao] ?? null : null;
  return (
    <div className="page sell-page">
      <div className="page-top"><Link className="icon-button" href="/me" aria-label="MY로"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></Link></div>
      <h1 className="page-title"><Icon name="shield" />로그인 연결</h1>
      <p className="page-lead">카카오를 연결하면 로그아웃하거나 휴대폰을 바꿔도 카카오로 지금 계정에 다시 들어올 수 있어요. 카카오에서는 회원번호만 받고 이름·연락처는 받지 않아요.</p>
      {message && <p className={kakao === "linked" || kakao === "unlinked" ? "login-message" : "login-message login-message--warn"} role="status">{message}</p>}
      <section className="link-card" aria-label="카카오 연결 상태">
        <div className="link-card__row">
          <span className="link-card__logo" aria-hidden="true">K</span>
          <div><strong>카카오</strong><small>{linked ? "연결됨" : on ? "연결 안 됨" : "준비 중"}</small></div>
        </div>
        {linked ? <KakaoUnlinkButton /> : on ? <KakaoButton href="/api/auth/kakao/start?mode=link" label="카카오 연결하기" /> : <p className="field-hint">카카오 로그인은 곧 열려요.</p>}
      </section>
      {!linked && <p className="field-hint">연결하지 않은 계정은 로그아웃하면 다시 들어올 수 없어요.</p>}
    </div>
  );
}
