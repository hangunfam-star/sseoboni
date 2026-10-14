import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";

// POST /api/profile-photo { show: boolean } — 내 카카오 프로필 사진을 써보니에 보이거나 숨긴다
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.show !== "boolean") return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  db.update(users).set({ showPhoto: body.show }).where(eq(users.id, userId)).run();
  return NextResponse.json({ show: body.show });
}
