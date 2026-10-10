import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { allowCreate, cleanNickname, createUser, NICKNAME_MAX, NICKNAME_MIN, readSignedValue, setSessionCookie } from "@/lib/session";
import { KakaoError, linkKakao, PENDING_COOKIE, userOfKakao, type KakaoPending } from "@/lib/kakao";

// POST /api/auth/kakao/complete { nickname } — 카카오 확인을 마친 새 사용자가 닉네임을 정하면 계정을 만들고 카카오를 연결한다.
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const pending = readSignedValue<KakaoPending>(jar.get(PENDING_COOKIE)?.value);
  if (!pending || pending.e < Date.now()) return NextResponse.json({ error: "카카오 확인 시간이 지났어요. 다시 카카오로 시작해 주세요.", code: "expired" }, { status: 410 });
  const body = await req.json().catch(() => null);
  const nickname = cleanNickname(body?.nickname);
  if (!nickname) return NextResponse.json({ error: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력하세요.` }, { status: 400 });

  const existing = userOfKakao(pending.k); // 다른 창에서 이미 가입을 마친 경우
  if (existing) {
    jar.delete(PENDING_COOKIE);
    await setSessionCookie(existing);
    return NextResponse.json({ created: false });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowCreate(ip, Date.now())) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  const user = createUser(nickname);
  try { linkKakao(user.id, pending.k); }
  catch (e) { return NextResponse.json({ error: "카카오 연결에 실패했어요. 다시 시도해 주세요.", code: e instanceof KakaoError ? e.code : "link" }, { status: 409 }); }
  jar.delete(PENDING_COOKIE);
  await setSessionCookie(user.id);
  return NextResponse.json({ created: true }, { status: 201 });
}
