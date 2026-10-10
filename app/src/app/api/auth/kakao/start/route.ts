import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, signValue } from "@/lib/session";
import { authorizeUrl, kakaoConfigured, safeNext, siteOrigin, STATE_COOKIE, STATE_MINUTES, type KakaoMode, type KakaoState } from "@/lib/kakao";

// GET /api/auth/kakao/start?mode=login|link&next=/경로 — 카카오 동의 화면으로 보낸다.
// 위조 방지값(state)을 서명 쿠키에 10분간 저장하고, 돌아왔을 때 같은지 확인한다.
export async function GET(req: NextRequest) {
  const origin = siteOrigin(req);
  const mode: KakaoMode = req.nextUrl.searchParams.get("mode") === "link" ? "link" : "login";
  const back = mode === "link" ? "/me/login" : "/login";
  if (!kakaoConfigured()) return NextResponse.redirect(`${origin}${back}?kakao=off`);
  if (mode === "link" && !(await getCurrentUserId())) return NextResponse.redirect(`${origin}/login?kakao=need-login`);
  const state = randomBytes(16).toString("base64url");
  const payload: KakaoState = { s: state, m: mode, n: safeNext(req.nextUrl.searchParams.get("next"), mode === "link" ? "/me/login" : "/"), e: Date.now() + STATE_MINUTES * 60_000 };
  (await cookies()).set(STATE_COOKIE, signValue(payload), {
    httpOnly: true, sameSite: "lax", path: "/api/auth/kakao", secure: process.env.NODE_ENV === "production", maxAge: STATE_MINUTES * 60,
  });
  return NextResponse.redirect(authorizeUrl(state, origin));
}
