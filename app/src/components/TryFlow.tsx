// 써보기 3단계(신청 → 집에서 써보기 → 사거나 돌려보내기). 홈 미션 카드·상세 써보기 안내에서 함께 쓴다.
const STEPS = [
  {
    label: "써보기 신청",
    // 손가락으로 누르기
    icon: <><path d="M9 11V5.5a1.5 1.5 0 013 0V11" /><path d="M12 10.5V9a1.5 1.5 0 013 0v2" /><path d="M15 10.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-4.6-2.2L4 15.5a1.5 1.5 0 012.3-1.9L9 16" /></>,
  },
  {
    label: "집에서 써보기",
    // 집
    icon: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  },
  {
    label: "사거나 돌려보내기",
    // 체크와 되돌리기 화살표
    icon: <><path d="M4 12a8 8 0 0113.7-5.6L20 8" /><path d="M20 4v4h-4" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  },
];

// param: label 목록 이름(화면 읽기용). return: 번호·아이콘·이름이 있는 3단계 목록
export function TryFlow({ label }: { label: string }) {
  return (
    <ol className="try-flow" aria-label={label}>
      {STEPS.map((s, i) => (
        <li key={s.label}>
          <div className="try-flow__head">
            <b>{i + 1}</b>
            <svg className="try-flow__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
          </div>
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
