import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUserId, sessionUserWithdrawn } from "@/lib/session";
import { blockersOf, retainUser, withdrawEnabled, withdrawUser, withdrawConfirmOk } from "@/lib/withdraw";
import { retainReady } from "@/lib/retain";

const OFF = () => NextResponse.json({ error: "지금은 탈퇴 기능을 쓸 수 없어요." }, { status: 503 });

// GET /api/me/withdraw — 탈퇴를 막는 거래 목록
export async function GET() {
  if (!withdrawEnabled()) return OFF();
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 카카오로 로그인해 주세요." }, { status: 401 });
  return NextResponse.json({ blockers: blockersOf(userId) });
}

// POST /api/me/withdraw { confirm: 자유 입력(공백 아닌 1~500자, 저장 안 함) } — 본인만, 본문의 사용자 id는 받지 않는다
export async function POST(req: NextRequest) {
  if (!withdrawEnabled()) return OFF();
  const userId = await getCurrentUserId();
  if (!userId) {
    // 이미 탈퇴한 사람의 쿠키(두 번 누름)는 탈퇴 끝으로, 그 밖(만료·로그아웃)은 401로 구분한다
    if (await sessionUserWithdrawn()) { await clearSessionCookie(); return NextResponse.json({ ok: true, already: true }); }
    return NextResponse.json({ error: "로그인이 끝났어요. 다시 로그인해 주세요." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!withdrawConfirmOk(body?.confirm)) return NextResponse.json({ error: "탈퇴하려면 칸에 아무 내용이나 입력해 주세요(500자까지)." }, { status: 400 });
  // 2단계 사전 점검: 보관 준비가 안 되면 아무것도 바꾸지 않는다(개인정보가 운영 DB에 무기한 남지 않게)
  if (!retainReady().ok) return NextResponse.json({ error: "지금은 탈퇴를 처리할 수 없어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
  const r = withdrawUser(userId);
  if ("blockers" in r) return NextResponse.json({ error: "끝나지 않은 거래가 있어 탈퇴할 수 없어요.", blockers: r.blockers }, { status: 409 });
  if ("ok" in r) {
    // 커밋 뒤 보관 이동. 실패해도 탈퇴는 끝났고 정기 작업이 이어서 한다
    try { retainUser(userId); } catch (e) { console.error("[withdraw] 보관 이동 실패(정기 작업이 재시도)", e); }
  }
  await clearSessionCookie();
  return NextResponse.json("already" in r ? { ok: true, already: true } : { ok: true });
}
