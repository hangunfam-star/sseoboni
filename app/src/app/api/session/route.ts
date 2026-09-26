import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, setSessionCookie, getCurrentUserId } from "@/lib/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ user: null });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return NextResponse.json({ user });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const nickname = String(body.nickname ?? "").trim();
  if (!nickname || nickname.length < 2) {
    return NextResponse.json({ error: "닉네임을 2자 이상 입력하세요." }, { status: 400 });
  }
  const user = await getOrCreateUser(nickname);
  await setSessionCookie(user.id);
  return NextResponse.json({ user });
}
