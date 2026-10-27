import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "탈퇴 완료 · 써보니", robots: { index: false, follow: false } };

// 탈퇴 완료 화면(탈퇴 1단계). 탈퇴 뒤 화면 전체를 새로 불러와 로그인 상태의 정보(계좌·알림 수 등)가 남지 않게 한다.
export default function WithdrawnPage() {
  return (
    <div className="page withdrawn-page">
      <section className="withdrawn-card" aria-live="polite">
        <span className="withdrawn-badge" aria-hidden="true"><Icon name="check" /></span>
        <h1 className="withdrawn-title">탈퇴가 끝났어요</h1>
        <p className="withdrawn-lead">그동안 써보니를 써 주셔서 고마워요.</p>
        <ul className="withdrawn-list">
          <li>판매 중이던 상품은 내려갔어요.</li>
          <li>거래·채팅·후기 기록은 &quot;탈퇴한 사용자&quot;로 남아요.</li>
          <li>같은 카카오 계정으로 다시 들어오면 새 계정으로 시작해요.</li>
        </ul>
        <Link className="dark-button withdrawn-home" href="/">처음 화면으로</Link>
      </section>
    </div>
  );
}
