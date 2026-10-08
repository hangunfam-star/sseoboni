import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, checkAdminKey, clearAdminCookie, setAdminCookie } from "@/lib/admin";

// 같은 IP에서 10분에 10번까지만 키를 시도할 수 있다(추측 방지). 서버 메모리 기준.
const tries = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 10;

// POST /api/admin/session { key } — 운영자 입장
export async function POST(req: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: "운영자 키가 설정되지 않았어요(.env ADMIN_KEY)." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_TRIES) return NextResponse.json({ error: "잠시 후 다시 시도하세요." }, { status: 429 });
  recent.push(now);
  tries.set(ip, recent);

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!checkAdminKey(key)) return NextResponse.json({ error: "키가 맞지 않아요." }, { status: 401 });
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/session — 운영자 나가기
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
