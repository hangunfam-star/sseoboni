import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  allowCreate,
  cleanNickname,
  clearSessionCookie,
  createUser,
  getCurrentUserId,
  NICKNAME_MAX,
  NICKNAME_MIN,
  sessionConfigured,
  setSessionCookie,
} from "@/lib/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ user: null });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return NextResponse.json({ user });
}

// POST /api/session { nickname } — 닉네임은 한 번 정하면 바꿀 수 없다(닉네임이 비어 있는 계정만 정할 수 있음).
// 새 계정은 카카오 로그인으로만 만든다(2026-10-14). 격리 시험 서버에서만 ALLOW_NICKNAME_LOGIN=1이면 닉네임으로 새 계정을 만든다.
export async function POST(req: NextRequest) {
  if (!sessionConfigured()) {
    return NextResponse.json({ error: "서버 로그인 설정이 완료되지 않았습니다." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const nickname = cleanNickname(body?.nickname);
  if (!nickname) {
    return NextResponse.json({ error: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력하세요.` }, { status: 400 });
  }

  const current = await getCurrentUserId();
  if (current) {
    const mine = await db.query.users.findFirst({ where: eq(users.id, current) });
    if (mine?.nickname) return NextResponse.json({ error: "닉네임은 한 번 정하면 바꿀 수 없어요." }, { status: 403 });
    const [user] = await db.update(users).set({ nickname }).where(eq(users.id, current)).returning();
    return NextResponse.json({ user, created: false });
  }

  // 시험 예외는 개발 서버에서만(운영 빌드는 환경 변수가 잘못 들어가도 항상 403)
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_NICKNAME_LOGIN !== "1") {
    return NextResponse.json({ error: "카카오로 로그인해 주세요." }, { status: 403 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowCreate(ip, Date.now())) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const user = createUser(nickname);
  await setSessionCookie(user.id);
  return NextResponse.json({ user, created: true }, { status: 201 });
}

// DELETE /api/session — 로그아웃
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
