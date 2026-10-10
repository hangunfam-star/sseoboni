import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { unlinkKakao } from "@/lib/kakao";

// DELETE /api/auth/kakao/link — 지금 계정의 카카오 연결 해제(계정·상품·거래는 그대로)
export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  return NextResponse.json({ ok: true, removed: unlinkKakao(userId) });
}
