import { BottomNav } from "./BottomNav";
import { TopMenu } from "./TopMenu";

// 화면마다 자체 헤더를 가진다(홈 워드마크, 상세 사진 위 뒤로가기 등). 셸은 폭·오른쪽 위 메뉴·하단 탭을 담당한다.
// param: isLocal 이 PC에서 직접 연 요청이면 true(메뉴에 운영자 결과 링크 표시)
export function AppShell({ children, isLocal }: { children: React.ReactNode; isLocal: boolean }) {
  return (
    <div className="app-shell">
      <TopMenu showAdmin={isLocal} />
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}
