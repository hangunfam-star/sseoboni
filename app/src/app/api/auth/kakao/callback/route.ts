import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, readSignedValue, setSessionCookie, signValue } from "@/lib/session";
import { KakaoError, kakaoUserId, linkKakao, PENDING_COOKIE, siteOrigin, STATE_COOKIE, STATE_MINUTES, userOfKakao, type KakaoPending, type KakaoState } from "@/lib/kakao";

// GET /api/auth/kakao/callback?code=…&state=… — 카카오에서 돌아오는 곳.
// 로그인: 연결된 계정이 있으면 그 계정으로 들어가고, 없으면 지금 들어와 있는 계정에 연결하거나 닉네임을 정해 새 계정을 만든다.
// 연결: 지금 계정에 카카오를 연결한다.
export async function GET(req: NextRequest) {
  const origin = siteOrigin(req);
  const jar = await cookies();
  const st = readSignedValue<KakaoState>(jar.get(STATE_COOKIE)?.value);
  jar.delete({ name: STATE_COOKIE, path: "/api/auth/kakao" });
  const q = req.nextUrl.searchParams;
  const fail = (code: string, mode = st?.m) => NextResponse.redirect(`${origin}${mode === "link" ? "/me/login" : "/login"}?kakao=${code}`);
  if (!st || st.e < Date.now() || !q.get("state") || q.get("state") !== st.s) return fail("state");
  if (q.get("error")) return fail("cancel");
  const code = q.get("code");
  if (!code) return fail("state");

  let kakaoId: string;
  try { kakaoId = await kakaoUserId(code, origin); }
  catch (e) { return fail(e instanceof KakaoError ? e.code : "token"); }

  const current = await getCurrentUserId();
  if (st.m === "link") {
    if (!current) return fail("need-login", "login");
    try { linkKakao(current, kakaoId); } catch (e) { return fail(e instanceof KakaoError ? e.code : "token"); }
    return NextResponse.redirect(`${origin}/me/login?kakao=linked`);
  }

  const owner = userOfKakao(kakaoId);
  if (owner) {
    await setSessionCookie(owner);
    return NextResponse.redirect(`${origin}${st.n}`);
  }
  if (current) { // 닉네임으로 쓰던 계정에서 카카오로 시작하면 그 계정에 연결한다(상품·거래가 그대로 이어짐)
    try { linkKakao(current, kakaoId); } catch (e) { return fail(e instanceof KakaoError ? e.code : "token"); }
    return NextResponse.redirect(`${origin}/me/login?kakao=linked`);
  }
  const pending: KakaoPending = { k: kakaoId, e: Date.now() + STATE_MINUTES * 60_000 };
  jar.set(PENDING_COOKIE, signValue(pending), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: STATE_MINUTES * 60 });
  return NextResponse.redirect(`${origin}/login?step=kakao&next=${encodeURIComponent(st.n)}`);
}
