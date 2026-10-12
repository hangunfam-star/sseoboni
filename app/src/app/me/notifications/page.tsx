import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getCurrentUserId } from "@/lib/session";
import { prefsOf } from "@/lib/notify";
import { NotifySettings } from "./NotifySettings";

export const metadata: Metadata = { title: "알림 설정 · 써보니", robots: { index: false, follow: false } };

// 알림 설정 — 이 기기 알림 켜기·홈 화면에 추가·종류별 켜고 끄기·밤 시간
export default async function NotifySettingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><h1 className="page-title"><Icon name="inbox" />알림 설정</h1><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  return (
    <div className="page sell-page">
      <div className="page-top"><Link className="icon-button" href="/me" aria-label="MY로"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></Link></div>
      <h1 className="page-title"><Icon name="inbox" />알림 · 홈 화면 추가</h1>
      <p className="page-lead">거래 기한과 새 채팅을 휴대폰 알림으로 받을 수 있어요. 아이폰은 홈 화면에 추가한 뒤 그 아이콘으로 열어야 알림을 받을 수 있어요.</p>
      <NotifySettings prefs={prefsOf(userId)} />
    </div>
  );
}
