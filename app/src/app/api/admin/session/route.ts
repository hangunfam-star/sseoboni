import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, checkAdminKey, clearAdminCookie, setAdminCookie } from "@/lib/admin";

// 키 추측 방지(서버 메모리 기준, 서버를 다시 켜면 초기화):
// - 같은 IP는 10분에 10번까지 시도. 시도는 본문을 읽기 전에 먼저 기록해 동시 요청으로 한도를 넘지 못하게 한다.
// - 틀릴 때마다 1초 늦게 답한다. 전체 한도는 비상용(10분 300번)으로만 둬서, 남이 일부러 틀려도 운영자가 쉽게 막히지 않게 한다.
// - IP는 터널(ngrok)이 X-Forwarded-For 끝에 붙이는 값. 서버는 127.0.0.1에만 열려 있어(package.json start) 바깥에서 직접 꾸민 값이 들어오지 않는다.
const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 10;
const MAX_TOTAL = 300;
const FAIL_DELAY_MS = 1000;
let total: number[] = [];

// POST /api/admin/session { key } — 운영자 입장
export async function POST(req: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: "운영자 키가 설정되지 않았어요(.env ADMIN_KEY)." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
  const now = Date.now();
  for (const [k, v] of attempts) {
    const kept = v.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) attempts.delete(k); else attempts.set(k, kept);
  }
  total = total.filter((t) => now - t < WINDOW_MS);
  const recent = attempts.get(ip) ?? [];
  if (recent.length >= MAX_PER_IP || total.length >= MAX_TOTAL) {
    return NextResponse.json({ error: "잠시 후 다시 시도하세요." }, { status: 429 });
  }
  // 기다리기(await) 전에 시도를 먼저 기록한다.
  attempts.set(ip, [...recent, now]);
  total.push(now);

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!checkAdminKey(key)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json({ error: "키가 맞지 않아요." }, { status: 401 });
  }
  // 성공한 시도는 기록에서 뺀다.
  attempts.set(ip, (attempts.get(ip) ?? []).filter((t) => t !== now));
  const i = total.indexOf(now);
  if (i >= 0) total.splice(i, 1);
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/session — 운영자 나가기(이 쿠키는 복사본까지 무효)
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
