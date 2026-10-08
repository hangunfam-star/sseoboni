import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
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

// 같은 접속지에서 계정을 대량으로 만드는 것을 막는 간단한 제한(서버 메모리 기준, 재시작 시 초기화)
const CREATE_LIMIT_PER_HOUR = 20;
const createLog = new Map<string, number[]>();

// param: ip 접속지. return: 이번 생성이 허용되면 true
function allowCreate(ip: string, now: number): boolean {
  const recent = (createLog.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= CREATE_LIMIT_PER_HOUR) {
    createLog.set(ip, recent);
    return false;
  }
  recent.push(now);
  createLog.set(ip, recent);
  return true;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ user: null });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return NextResponse.json({ user });
}

// POST /api/session { nickname } — 링크를 받은 누구나 닉네임만으로 시작.
// 이미 세션이 있으면 새 계정을 만들지 않고 닉네임만 바꾼다(같은 사람의 계정 중복 방지).
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
    const [user] = await db.update(users).set({ nickname }).where(eq(users.id, current)).returning();
    return NextResponse.json({ user, created: false });
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
