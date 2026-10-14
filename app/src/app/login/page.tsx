import { cookies } from "next/headers";
import { KAKAO_MESSAGES, kakaoConfigured, PENDING_COOKIE, readPending, safeNext } from "@/lib/kakao";
import { LoginForm } from "./LoginForm";
import { loadTradeSettings } from "@/lib/trade-settings-store";

// 시작 화면 — 카카오로 시작(키가 설정된 경우) 또는 닉네임만 정하고 시작.
// ?step=kakao: 카카오 확인을 마친 새 사용자가 닉네임을 정하는 단계. ?kakao=코드: 안내 문구
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ step?: string; kakao?: string; next?: string }> }) {
  const { step, kakao, next } = await searchParams;
  const pending = readPending((await cookies()).get(PENDING_COOKIE)?.value);
  const pendingOk = pending !== null;
  const kakaoStep = step === "kakao" && pendingOk;
  const message = step === "kakao" && !pendingOk ? KAKAO_MESSAGES.expired : kakao ? KAKAO_MESSAGES[kakao] ?? null : null;
  const { tradeOpen } = await loadTradeSettings();
  return <LoginForm tradeOpen={tradeOpen} kakaoOn={kakaoConfigured()} kakaoStep={kakaoStep} kakaoNickname={kakaoStep ? pending?.n ?? null : null} message={message} next={safeNext(next)} />;
}
