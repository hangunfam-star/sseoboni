import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { markNotificationsRead, unreadCount } from "@/lib/notify";

// GET /api/notifications?count=1 — 안 읽은 수만(상단 종 배지). ?before=시각 — 그 이전 30개(더 보기)
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ unread: 0, tradeUnread: 0, items: [] });
  if (req.nextUrl.searchParams.get("count")) {
    const trade = db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.category, "TRADE"), isNull(notifications.readAt))).limit(1).get();
    return NextResponse.json({ unread: unreadCount(userId), tradeUnread: trade ? 1 : 0 });
  }
  const before = req.nextUrl.searchParams.get("before");
  const items = db.select({ id: notifications.id, category: notifications.category, title: notifications.title, body: notifications.body, url: notifications.url, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications).where(and(eq(notifications.userId, userId), before ? lt(notifications.createdAt, before) : undefined))
    .orderBy(desc(notifications.createdAt)).limit(31).all();
  return NextResponse.json({ items: items.slice(0, 30), hasMore: items.length > 30, unread: unreadCount(userId) });
}

// POST /api/notifications { ids?: string[] } — 고른 알림(없으면 전부) 읽음
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 100) : [];
  if (ids.length > 0) {
    db.update(notifications).set({ readAt: new Date().toISOString() }).where(and(eq(notifications.userId, userId), inArray(notifications.id, ids), isNull(notifications.readAt))).run();
  } else {
    markNotificationsRead(userId);
  }
  return NextResponse.json({ unread: unreadCount(userId) });
}
