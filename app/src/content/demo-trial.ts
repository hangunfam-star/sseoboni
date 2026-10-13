// 메인 "써보기 이야기" 예시 데이터(2026-10-13, 사용자 결정). 실제 기록이 아니다 — 화면마다 "예시" 표시를 반드시 붙인다.
// 실제 DB와 섞지 않으려고 파일로 둔다. 실제 써보기 완료가 DEMO_UNTIL_REAL 이상이면 메인에서 예시를 내린다.
export const DEMO_UNTIL_REAL = 30;

export type DemoStats = { title: string; items: { value: string; unit: string; label: string }[] };
export const DEMO_STATS: DemoStats[] = [
  { title: "전체", items: [
    { value: "1,284", unit: "명", label: "써보고 결정한 사람" },
    { value: "71", unit: "%", label: "써본 뒤 구매" },
    { value: "2.3", unit: "일", label: "평균 써본 기간" },
    { value: "9.1", unit: "/10", label: "평균 써보기 만족" },
  ] },
  { title: "태블릿", items: [
    { value: "412", unit: "명", label: "써보고 결정한 사람" },
    { value: "76", unit: "%", label: "써본 뒤 구매" },
    { value: "1.9", unit: "일", label: "평균 써본 기간" },
    { value: "화면", unit: "", label: "가장 많이 확인한 점" },
  ] },
  { title: "노트북", items: [
    { value: "358", unit: "명", label: "써보고 결정한 사람" },
    { value: "68", unit: "%", label: "써본 뒤 구매" },
    { value: "2.8", unit: "일", label: "평균 써본 기간" },
    { value: "배터리", unit: "", label: "가장 많이 확인한 점" },
  ] },
];

export type DemoReview = { model: string; emoji: string; hours: number; fee: number; outcome: "PURCHASED" | "RETURNED"; score: number; checked: string[]; better: string; quote: string };
export const DEMO_REVIEWS: DemoReview[] = [
  { model: "아이패드 프로 4세대", emoji: "📱", hours: 48, fee: 4000, outcome: "PURCHASED", score: 10,
    checked: ["배터리 실제로 하루 감", "화면 멍 없음 직접 확인", "펜슬 잘 붙음"], better: "하자 걱정 없이 샀어요",
    quote: "사진엔 안 보이던 화면 멍이 걱정이었는데, 밝게 켜 놓고 이틀 써보니 마음 놓고 샀어요." },
  { model: "에어팟 맥스", emoji: "🎧", hours: 24, fee: 3000, outcome: "RETURNED", score: 8,
    checked: ["음질 좋음", "무게가 생각보다 무거움"], better: "체험료만 내고 끝나 후회 없음",
    quote: "오래 쓰기엔 무거워서 돌려보냈어요. 사기 전에 알아서 다행이에요." },
  { model: "맥북 에어 M2", emoji: "💻", hours: 72, fee: 6000, outcome: "PURCHASED", score: 9,
    checked: ["키보드 눌림 정상", "배터리 효율 확인", "충전기 정품"], better: "실제 작업으로 성능 확인",
    quote: "평소 쓰는 프로그램을 3일 돌려 봤어요. 발열도 괜찮아서 바로 구매했어요." },
];

export type DemoVerdict = { model: string; bought: number; returned: number; topChecked: string; topReturn: string; avgHours: number };
export const DEMO_VERDICTS: DemoVerdict[] = [
  { model: "아이패드 프로", bought: 9, returned: 3, topChecked: "화면 상태 8명", topReturn: "생각보다 큼 2명", avgHours: 41 },
  { model: "맥북 에어 M2", bought: 12, returned: 5, topChecked: "배터리 11명", topReturn: "용도와 다름 3명", avgHours: 58 },
  { model: "에어팟 맥스", bought: 4, returned: 6, topChecked: "착용감 9명", topReturn: "무거움 4명", avgHours: 26 },
];

export type DemoActivity = { when: string; place: string; text: string };
export const DEMO_ACTIVITY: DemoActivity[] = [
  { when: "방금", place: "마포구", text: "갤럭시탭 S9 써보기 시작" },
  { when: "5분 전", place: "수원", text: "맥북 에어 M2 써보고 구매" },
  { when: "12분 전", place: "부산 해운대구", text: "에어팟 맥스 써보고 반납 · 체험료 3,000원" },
];
