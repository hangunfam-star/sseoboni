import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, checkAdminKey, clearAdminCookie, setAdminCookie } from "@/lib/admin";

// 키 추측 방지(서버 메모리 기준): 같은 IP는 10분에 실패 10번, 전체는 10분에 실패 30번까지.
// IP는 터널(ngrok)이 X-Forwarded-For 끝에 붙이는 값을 쓴다(앞쪽 값은 요청자가 꾸밀 수 있다).
const fails = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS_PER_IP = 10;
const MAX_FAILS_TOTAL = 30;
let totalFails: number[] = [];

// POST /api/admin/session { key } — 운영자 입장
export async function POST(req: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: "운영자 키가 설정되지 않았어요(.env ADMIN_KEY)." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
  const now = Date.now();
  for (const [k, v] of fails) {
    const kept = v.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) fails.delete(k); else fails.set(k, kept);
  }
  totalFails = totalFails.filter((t) => now - t < WINDOW_MS);
  const recent = fails.get(ip) ?? [];
  if (recent.length >= MAX_FAILS_PER_IP || totalFails.length >= MAX_FAILS_TOTAL) {
    return NextResponse.json({ error: "잠시 후 다시 시도하세요." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!checkAdminKey(key)) {
    fails.set(ip, [...recent, now]);
    totalFails.push(now);
    return NextResponse.json({ error: "키가 맞지 않아요." }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/session — 운영자 나가기
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
