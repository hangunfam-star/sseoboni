// 카카오 로그인 버튼(카카오 디자인 가이드: 노란 바탕 #FEE500, 검은 말풍선 심볼). 서버 경로로 이동하는 일반 링크라 자바스크립트 없이도 동작한다.
// param: href 이동할 주소, label 버튼 글자
export function KakaoButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="kakao-button" href={href}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.83 1.9 5.32 4.75 6.72l-.97 3.56c-.09.32.27.57.55.39l4.24-2.8c.47.05.95.08 1.43.08 5.52 0 10-3.54 10-7.95S17.52 3 12 3z" /></svg>
      <span>{label}</span>
    </a>
  );
}
