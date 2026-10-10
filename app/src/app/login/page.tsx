import { cookies } from "next/headers";
import { KAKAO_MESSAGES, kakaoConfigured, PENDING_COOKIE, readPending, safeNext } from "@/lib/kakao";
import { LoginForm } from "./LoginForm";

// 시작 화면 — 카카오로 시작(키가 설정된 경우) 또는 닉네임만 정하고 시작.
// ?step=kakao: 카카오 확인을 마친 새 사용자가 닉네임을 정하는 단계. ?kakao=코드: 안내 문구
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ step?: string; kakao?: string; next?: string }> }) {
  const { step, kakao, next } = await searchParams;
  const pendingOk = readPending((await cookies()).get(PENDING_COOKIE)?.value) !== null;
  const kakaoStep = step === "kakao" && pendingOk;
  const message = step === "kakao" && !pendingOk ? KAKAO_MESSAGES.expired : kakao ? KAKAO_MESSAGES[kakao] ?? null : null;
  return <LoginForm kakaoOn={kakaoConfigured()} kakaoStep={kakaoStep} message={message} next={safeNext(next)} />;
}
