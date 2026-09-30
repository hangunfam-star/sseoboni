import { BottomNav } from "./BottomNav";

// 화면마다 자체 헤더를 가진다(홈 워드마크, 상세 사진 위 뒤로가기 등). 셸은 폭과 하단 탭만 담당한다.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}
