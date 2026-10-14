import { BottomNav } from "./BottomNav";
import { TopMenu } from "./TopMenu";
import { InstallPrompt } from "./InstallPrompt";

// 화면마다 자체 헤더를 가진다(홈 워드마크, 상세 사진 위 뒤로가기 등). 셸은 폭·오른쪽 위 메뉴·하단 탭을 담당한다.
// param: isLocal 이 PC에서 직접 연 요청이면 true(메뉴에 운영자 결과 링크 표시)
// param: tradeOpen 거래 열림(메뉴 안내 문구)
export function AppShell({ children, isLocal, tradeOpen }: { children: React.ReactNode; isLocal: boolean; tradeOpen: boolean }) {
  return (
    <div className="app-shell">
      <TopMenu showAdmin={isLocal} tradeOpen={tradeOpen} />
      <main className="app-main">{children}</main>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
