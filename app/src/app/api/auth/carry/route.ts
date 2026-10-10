import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, setSessionCookie } from "@/lib/session";
import { readCarry } from "@/lib/login-link";
import { safeNext, siteOrigin } from "@/lib/kakao";

// GET /api/auth/carry?t=…&next=/경로 — 예전 주소(ngrok)에서 넘어온 로그인을 이어받는다.
// 표는 예전 주소 쪽(PC 이동 서버)이 같은 SESSION_SECRET으로 서명해 2분 동안만 유효하고 한 번만 쓰인다.
// 새 주소에서 이미 들어와 있는 사람은 바꾸지 않는다.
export async function GET(req: NextRequest) {
  const origin = siteOrigin(req);
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const userId = readCarry(req.nextUrl.searchParams.get("t"));
  if (userId && !(await getCurrentUserId())) await setSessionCookie(userId);
  const res = NextResponse.redirect(`${origin}${next}`);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
