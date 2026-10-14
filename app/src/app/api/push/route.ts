import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { vapidPublicKey } from "@/lib/notify";

// GET /api/push?endpoint=… — 공개키와 이 기기가 내 계정으로 구독돼 있는지
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  const mine = userId && endpoint ? Boolean(db.select({ e: pushSubscriptions.endpoint }).from(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId))).get()) : false;
  const devices = userId ? db.get<{ n: number }>(sql`select count(*) as n from push_subscriptions where user_id = ${userId}`)?.n ?? 0 : 0;
  return NextResponse.json({ publicKey: vapidPublicKey(), subscribed: mine, devices });
}

// POST /api/push { endpoint, keys: { p256dh, auth } } — 이 기기로 알림 받기(같은 기기는 지금 계정으로 바뀜)
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (!vapidPublicKey()) return NextResponse.json({ error: "알림 발송이 아직 설정되지 않았어요." }, { status: 503 });
  const b = await req.json().catch(() => null);
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  const p256dh = typeof b?.keys?.p256dh === "string" ? b.keys.p256dh : "";
  const auth = typeof b?.keys?.auth === "string" ? b.keys.auth : "";
  if (!/^https?:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: "알림 구독 정보가 올바르지 않아요." }, { status: 400 });
  }
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 200);
  const owner = db.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).get();
  if (owner && owner.userId !== userId) {
    return NextResponse.json({ error: "이 기기는 다른 계정의 알림으로 등록돼 있어요.", code: "taken" }, { status: 409 });
  }
  // 동시에 다른 계정이 같은 기기를 등록해도 덮어쓰지 않게: 소유자가 같을 때만 갱신(바뀐 행 0이면 거부)
  const r = db.insert(pushSubscriptions).values({ endpoint, userId, p256dh, auth, userAgent })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh, auth, userAgent, failCount: 0 }, setWhere: eq(pushSubscriptions.userId, userId) }).run();
  if (r.changes === 0) return NextResponse.json({ error: "이 기기는 다른 계정의 알림으로 등록돼 있어요.", code: "taken" }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/push { endpoint } — 이 기기 알림 끄기(내 기기만)
export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  const removed = db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId))).run().changes;
  return NextResponse.json({ ok: true, removed });
}
