import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateInviteUser,
  setSessionCookie,
  getCurrentUserId,
  clearSessionCookie,
  sessionConfigured,
} from "@/lib/session";
import { findActiveInviteByCode, findActiveInviteByUserId } from "@/lib/invites";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ user: null });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return NextResponse.json({ user, nickname: findActiveInviteByUserId(userId)?.nickname ?? null });
}

// POST /api/session { code } — 개인 초대 코드로 로그인
export async function POST(req: NextRequest) {
  if (!sessionConfigured()) {
    return NextResponse.json({ error: "서버 로그인 설정이 완료되지 않았습니다." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const invite = code ? findActiveInviteByCode(code) : null;
  if (!invite) {
    return NextResponse.json({ error: "초대 코드가 올바르지 않습니다." }, { status: 401 });
  }
  const user = await getOrCreateInviteUser(invite);
  await setSessionCookie(user.id);
  return NextResponse.json({ user, nickname: invite.nickname });
}

// DELETE /api/session — 로그아웃
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
