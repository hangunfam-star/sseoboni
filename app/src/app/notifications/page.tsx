import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { Icon } from "@/components/Icon";
import { getCurrentUserId } from "@/lib/session";
import { relativeTime } from "@/ui/presentation";
import { NotificationList } from "./NotificationList";

export const metadata: Metadata = { title: "알림 · 써보니", robots: { index: false, follow: false } };

// 알림함 — 최근 50개. 누르면 읽음 처리하고 해당 화면으로 간다.
export default async function NotificationsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><h1 className="page-title"><Icon name="inbox" />알림</h1><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  const rows = db.select().from(notifications).where(and(eq(notifications.userId, userId))).orderBy(desc(notifications.createdAt)).limit(50).all();
  const items = rows.map((r) => ({ id: r.id, category: r.category, title: r.title, body: r.body, url: r.url, read: Boolean(r.readAt), when: relativeTime(r.createdAt) }));
  return (
    <div className="page notifications-page">
      <div className="notifications-head">
        <h1 className="page-title"><Icon name="inbox" />알림</h1>
        <Link className="text-button" href="/me/notifications">알림 설정</Link>
      </div>
      <NotificationList items={items} />
    </div>
  );
}
