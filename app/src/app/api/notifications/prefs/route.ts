import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationPrefs } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { prefsOf } from "@/lib/notify";

// GET /api/notifications/prefs — 알림 설정(거래 알림은 항상 켬)
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  return NextResponse.json({ prefs: prefsOf(userId) });
}

// PUT /api/notifications/prefs { chat?, interest?, review?, quiet? } — 바꾼 값만 저장
export async function PUT(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const cur = prefsOf(userId);
  const pick = (k: keyof typeof cur) => (typeof body?.[k] === "boolean" ? body[k] : cur[k]);
  const next = { chat: pick("chat"), interest: pick("interest"), review: pick("review"), quiet: pick("quiet") };
  db.insert(notificationPrefs).values({ userId, ...next }).onConflictDoUpdate({ target: notificationPrefs.userId, set: { ...next, updatedAt: sql`(current_timestamp)` } }).run();
  return NextResponse.json({ prefs: next });
}
