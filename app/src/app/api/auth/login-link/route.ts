import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { consumeLoginLink } from "@/lib/login-link";

// POST /api/auth/login-link { t } — 운영자가 보낸 복구 링크를 써서 그 계정으로 들어간다(한 번만).
// 지금 다른 계정으로 들어와 있어도 링크의 계정으로 바꾼다(되찾으려고 누른 것이므로).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = consumeLoginLink(typeof body?.t === "string" ? body.t : "");
  if (!userId) return NextResponse.json({ error: "이 링크는 이미 썼거나 기간이 지났어요. 운영자에게 새 링크를 요청해 주세요." }, { status: 410 });
  await setSessionCookie(userId);
  return NextResponse.json({ ok: true });
}
