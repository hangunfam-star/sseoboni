// 거래 규칙(화면·서버 공통, 순수 함수). 2026-10-09 사용자 결정 기준:
// - 결제는 구매자가 판매자 계좌로 직접 보낸다. 써보니는 돈을 받지 않고 계산·안내·기록만 한다.
// - 사면 체험료 0원. 돌려보내면 환불 = 상품가 − 체험료(발송비·반송비는 구매자 부담, 반납 수수료 없음).
// - 수수료는 구매 완료 건의 판매가 × 수수료율(베타 0%, 정식 3%)을 판매자에게 따로 청구한다(정식 운영 때).
// - 체험 시작 = 수령 확인 시점. 기한까지 답이 없으면 "확인 필요" → 유예 뒤 구매 확정.
import { platformFee, tierForHours, type TrialTier } from "@/ui/trial-pricing";

export type OrderKind = "BUY" | "TRIAL";
export type OrderStatus =
  | "AWAIT_PAYMENT" | "PAID" | "SHIPPED" | "RECEIVED" | "TRIAL" | "NEEDS_CHECK"
  | "RETURN_REQUESTED" | "RETURN_SHIPPED" | "REFUND_DUE" | "REFUND_SENT"
  | "PURCHASED" | "RETURNED" | "CANCELLED";

export const FINAL_STATUSES: OrderStatus[] = ["PURCHASED", "RETURNED", "CANCELLED"];
export const isFinal = (s: string) => (FINAL_STATUSES as string[]).includes(s);

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAIT_PAYMENT: "입금 대기",
  PAID: "입금 확인 · 발송 대기",
  SHIPPED: "배송 중",
  RECEIVED: "받음 · 구매 확정 대기",
  TRIAL: "써보는 중",
  NEEDS_CHECK: "확인 필요",
  RETURN_REQUESTED: "반납 신청 · 반송 대기",
  RETURN_SHIPPED: "반송 중 · 검수 대기",
  REFUND_DUE: "환불 대기",
  REFUND_SENT: "환불 보냄 · 확인 대기",
  PURCHASED: "구매 완료",
  RETURNED: "반납 완료",
  CANCELLED: "취소됨",
};

// 운영자가 바꿀 수 있는 기한·기준(설정값). runtime-data/trade-settings.json으로 덮어쓴다.
export type TradeSettings = {
  tradeOpen: boolean;          // 거래 열기(사용자 승인 전 false)
  paymentWaitHours: number;    // 입금 기한
  shipPromiseDays: number;     // 입금 확인 뒤 발송 약속
  autoReceiveDays: number;     // 발송 뒤 받음 버튼을 안 누르면 자동 수령
  decisionGraceHours: number;  // 체험 기한 뒤 "확인 필요" 유예
  buyAutoConfirmDays: number;  // 바로 구매: 받은 뒤 자동 구매 확정
  returnShipDays: number;      // 반납 신청 뒤 반송 약속
  inspectDays: number;         // 반송 인계일 뒤 검수 기한
  refundDays: number;          // 검수·취소 확정 뒤 환불 기한
  reviewWindowDays: number;    // 후기 작성 기간
  reviewRevealDays: number;    // 상대가 안 써도 공개되는 날
  gradeSteps: number[];        // 등급 경계(경험치)
  statsMinCount: number;       // 시세 최소 거래 수
  statsDays: number;           // 시세·신뢰 집계 기간
  formalFeePct: number;        // 정식 수수료율(기록용)
};

export const DEFAULT_TRADE_SETTINGS: TradeSettings = {
  tradeOpen: false,
  paymentWaitHours: 48,
  shipPromiseDays: 2,
  autoReceiveDays: 5,
  decisionGraceHours: 72,
  buyAutoConfirmDays: 3,
  returnShipDays: 2,
  inspectDays: 5,
  refundDays: 2,
  reviewWindowDays: 14,
  reviewRevealDays: 7,
  gradeSteps: [0, 3, 10, 30, 100],
  statsMinCount: 3,
  statsDays: 90,
  formalFeePct: 3,
};

// param: v 파일 내용(unknown). return: 검증된 설정(빠진 값은 기본값), 잘못되면 오류 문구
export function parseTradeSettings(v: unknown): TradeSettings | string {
  if (!v || typeof v !== "object") return "설정 형식이 올바르지 않습니다.";
  const o = { ...DEFAULT_TRADE_SETTINGS, ...(v as Partial<TradeSettings>) };
  const nums: (keyof TradeSettings)[] = ["paymentWaitHours", "shipPromiseDays", "autoReceiveDays", "decisionGraceHours", "buyAutoConfirmDays", "returnShipDays", "inspectDays", "refundDays", "reviewWindowDays", "reviewRevealDays", "statsMinCount", "statsDays"];
  for (const k of nums) {
    const x = o[k];
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > 365) return `${k}는 1~365 정수여야 합니다.`;
  }
  if (typeof o.tradeOpen !== "boolean") return "tradeOpen은 true/false여야 합니다.";
  if (typeof o.formalFeePct !== "number" || o.formalFeePct < 0 || o.formalFeePct > 30) return "formalFeePct는 0~30이어야 합니다.";
  const g = o.gradeSteps;
  if (!Array.isArray(g) || g.length !== GRADE_NAMES.length || g[0] !== 0 || g.some((x, i) => !Number.isInteger(x) || (i > 0 && x <= g[i - 1]))) return "gradeSteps는 0으로 시작하는 증가 정수 5개여야 합니다.";
  return o;
}

// ── 시간 ──
const H = 3600_000;
export const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * H).toISOString();
export const hoursBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / H;
// SQLite current_timestamp("YYYY-MM-DD HH:MM:SS", UTC) → ISO
export const sqlToIso = (s: string) => (s.includes("T") ? s : `${s.replace(" ", "T")}Z`);

// param: iso 시각(SQLite 형식도 가능). return: 한국 시간 "10월 9일 18:30"
export function kst(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(new Date(sqlToIso(iso)).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// return: 오늘 한국 날짜 YYYY-MM-DD
export const kstToday = () => new Date(new Date().getTime() + 9 * 3600_000).toISOString().slice(0, 10);

// ── 돈 ──
export type Money = {
  payTotal: number;        // 판매자에게 처음 보낼 금액 = 상품가 + 발송비
  buyExtra: number;        // 사면 더 낼 돈(항상 0)
  returnCharge: number;    // 돌려보내면 빠지는 체험료
  refundIfReturn: number;  // 돌려보내면 환불 예정액 = 상품가 − 체험료(발송비는 환불하지 않음)
};

// param: price 상품가, shippingFee 구매자 부담 발송비, trialFee 체험료(바로 구매면 null)
export function moneyOf(price: number, shippingFee: number, trialFee: number | null): Money {
  const fee = trialFee ?? 0;
  return { payTotal: price + shippingFee, buyExtra: 0, returnCharge: fee, refundIfReturn: Math.max(0, price - fee) };
}

// param: tiers 신청 시점 구간, chosenHours 고른 구간, usedHours 받은 뒤 지난 시간
// return: 반납 때 적용할 체험료. 고른 구간 안이면 그 요금, 넘기면 다음 구간 요금, 가장 긴 구간도 넘기면 가장 긴 구간 요금(유예 중 반납)
export function returnFeeFor(tiers: TrialTier[], chosenHours: number, usedHours: number): number {
  const sorted = [...tiers].sort((a, b) => a.hours - b.hours);
  const chosen = sorted.find((t) => t.hours === chosenHours) ?? sorted[0];
  if (usedHours <= chosen.hours) return chosen.fee;
  return (tierForHours(usedHours, sorted) ?? sorted[sorted.length - 1]).fee;
}

// param: price 판매가, feePct 그때 수수료율, formalPct 정식 수수료율. return: 청구 수수료·정식이었다면 수수료
export function purchaseFees(price: number, feePct: number, formalPct: number) {
  return { feeAmount: platformFee(price, feePct), virtualFee: platformFee(price, formalPct) };
}

// ── 상태 전환(누가 언제 무엇을 할 수 있나) ──
export type Role = "buyer" | "seller";
export type Action =
  | "CONFIRM_PAYMENT" | "SHIP" | "RECEIVED" | "EXTEND" | "PURCHASE" | "RETURN"
  | "RETURN_SHIPPED" | "INSPECT" | "REFUND_SENT" | "REFUND_RECEIVED" | "CANCEL";

// return: 이 역할이 지금 상태에서 할 수 있는 행동
export function allowedActions(kind: OrderKind, status: OrderStatus, role: Role, disputeOpen: boolean): Action[] {
  const a: Action[] = [];
  if (role === "seller") {
    if (status === "AWAIT_PAYMENT") a.push("CONFIRM_PAYMENT", "CANCEL");
    if (status === "PAID") a.push("SHIP", "CANCEL");
    if (status === "RETURN_SHIPPED") a.push("INSPECT");
    if (status === "REFUND_DUE") a.push("REFUND_SENT");
  } else {
    if (status === "AWAIT_PAYMENT" || status === "PAID") a.push("CANCEL");
    if (status === "SHIPPED") a.push("RECEIVED");
    if (status === "RECEIVED" && kind === "BUY") a.push("PURCHASE");
    if (status === "TRIAL") a.push("EXTEND", "PURCHASE", "RETURN");
    if (status === "NEEDS_CHECK") a.push("PURCHASE", "RETURN");
    if (status === "RETURN_REQUESTED") a.push("RETURN_SHIPPED");
    if (status === "REFUND_SENT") a.push("REFUND_RECEIVED");
  }
  // 분쟁 중에는 물건 이동(입금 확인·발송·받음·반송)만 허용하고, 금액·결과가 확정되는 행동은 운영자 확인 뒤로 미룬다. 자동 처리도 멈춘다.
  const DURING_DISPUTE: Action[] = ["CONFIRM_PAYMENT", "SHIP", "RECEIVED", "RETURN_SHIPPED"];
  return disputeOpen ? a.filter((x) => DURING_DISPUTE.includes(x)) : a;
}

// ── 체험 전 궁금한 점(최대 3) ──
const QUESTIONS: Record<string, string[]> = {
  신발: ["사이즈감", "착화감", "무게", "밑창·굽 상태", "냄새"],
  의류: ["핏·사이즈감", "두께·보온", "색감", "보풀·얼룩", "촉감"],
  노트북: ["배터리", "발열·소음", "화면 상태", "키보드", "무게"],
  태블릿: ["배터리", "화면 상태", "펜·터치 반응", "무게", "발열"],
  스마트폰: ["배터리", "화면 상태", "카메라", "발열", "통화 품질"],
  오디오: ["음질", "노이즈 캔슬링", "착용감", "배터리", "연결"],
  카메라: ["화질", "초점 속도", "무게", "배터리", "외관"],
  게임기: ["구동 상태", "소음·발열", "패드 상태", "저장 공간", "외관"],
  생활가전: ["소음", "무게", "전력·성능", "크기", "사용 편의"],
};
const COMMON_QUESTIONS = ["실물 상태", "크기", "무게", "사용 편의", "소음"];
export const questionsFor = (category: string | null) => (category && QUESTIONS[category]) || COMMON_QUESTIONS;

// param: v 요청 값. return: 정리된 질문(최대 3, 각 20자), 잘못되면 오류 문구
export function parseQuestions(v: unknown): string[] | string {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return "궁금한 점 형식이 올바르지 않습니다.";
  const q = [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))];
  if (q.length > 3) return "궁금한 점은 3개까지 고를 수 있어요.";
  if (q.some((x) => x.length > 20)) return "궁금한 점은 20자 이하로 적어 주세요.";
  return q;
}

// ── 반납 이유와 다음 검색 제안 ──
export const RETURN_REASONS = [
  { key: "SIZE", label: "크기·사이즈가 안 맞아요", next: "다른 사이즈 찾아보기" },
  { key: "HEAVY", label: "생각보다 무거워요", next: "같은 종류 다른 상품 보기" },
  { key: "USE", label: "생각한 용도와 달라요", next: "같은 종류 다른 상품 보기" },
  { key: "NEEDLESS", label: "필요하지 않았어요", next: null },
  { key: "MISMATCH", label: "설명과 달라요", next: null, dispute: true },
  { key: "DEFECT", label: "하자가 있어요", next: null, dispute: true },
  { key: "OTHER", label: "기타", next: null },
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number]["key"];
export const returnReasonOf = (k: string | null) => RETURN_REASONS.find((r) => r.key === k) ?? null;

// ── 후기 문구 ──
export const REVIEW_CHIPS = {
  B2S: {
    good: ["배송이 빨라요", "설명 그대로예요", "구성품이 다 있어요", "친절해요", "포장이 꼼꼼해요", "응답이 빨라요"],
    bad: ["배송이 늦어요", "설명과 달라요", "구성품이 빠졌어요", "응답이 늦어요", "포장이 아쉬워요"],
  },
  S2B: {
    good: ["구매확정이 빨라요", "반납이 깨끗해요", "기한을 잘 지켜요", "약속을 잘 지켜요", "응답이 빨라요", "매너가 좋아요"],
    bad: ["반납이 늦어요", "구성품이 빠졌어요", "응답이 늦어요", "약속을 안 지켜요"],
  },
} as const;
export const REVIEW_SAMPLES = {
  B2S: ["좋은 물건 저렴하게 잘 산 것 같아요.", "쿨거래 감사합니다.", "써보고 결정할 수 있어서 안심됐어요.", "설명대로라 믿고 거래했어요."],
  S2B: ["쿨거래 감사합니다.", "깨끗하게 써 주셔서 감사해요.", "약속을 잘 지켜 주셨어요.", "다음에도 거래해요."],
} as const;

// param: direction, stars 1~10. return: 점수에 맞는 문구 목록(7점 이상 칭찬, 4점 이하 아쉬움, 그 사이 둘 다)
export function chipsFor(direction: "B2S" | "S2B", stars: number): string[] {
  const c = REVIEW_CHIPS[direction];
  if (stars >= 7) return [...c.good];
  if (stars <= 4) return [...c.bad];
  return [...c.good, ...c.bad];
}

// ── 활동 등급 ──
export const GRADE_NAMES = ["써린이", "써본이", "써잘알", "써고수", "써신"] as const;
// param: xp 경험치, steps 경계. return: 등급 이름·번호·다음 등급까지 남은 경험치(최고면 null)
export function gradeOf(xp: number, steps: number[] = DEFAULT_TRADE_SETTINGS.gradeSteps) {
  let i = 0;
  for (let k = 0; k < steps.length; k++) if (xp >= steps[k]) i = k;
  return { name: GRADE_NAMES[i], level: i + 1, toNext: i + 1 < steps.length ? steps[i + 1] - xp : null };
}

// ── 통계 ──
// param: values 숫자 목록. return: 중앙값(비었으면 null)
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// param: done 지킨 수, total 전체. return: "9/10회" 또는 "기록 없음"
export const ratioText = (done: number, total: number) => (total === 0 ? "기록 없음" : `${done}/${total}회`);

// param: nickname 닉네임. return: 입금자명(닉네임 앞 4글자 + 숫자 4자리)
export function depositNameFor(nickname: string | null, rand: number): string {
  const head = Array.from((nickname ?? "써보니").replace(/\s/g, "")).slice(0, 4).join("");
  return `${head}${String(rand % 10000).padStart(4, "0")}`;
}

// ── 입력 검증 ──
export const BANKS = ["국민", "신한", "우리", "하나", "농협", "기업", "카카오뱅크", "토스뱅크", "케이뱅크", "SC제일", "씨티", "대구", "부산", "경남", "광주", "전북", "제주", "수협", "새마을금고", "신협", "우체국", "산업"] as const;

// param: v {bank, account, holder}. return: 정리된 계좌, 잘못되면 오류 문구
export function parseBankAccount(v: unknown): { bank: string; account: string; holder: string } | string {
  const o = (v ?? {}) as Record<string, unknown>;
  const bank = typeof o.bank === "string" ? o.bank.trim() : "";
  const account = typeof o.account === "string" ? o.account.replace(/[\s-]/g, "") : "";
  const holder = typeof o.holder === "string" ? o.holder.trim() : "";
  if (!(BANKS as readonly string[]).includes(bank)) return "은행을 골라 주세요.";
  if (!/^\d{10,16}$/.test(account)) return "계좌번호는 숫자 10~16자리로 입력하세요.";
  if (holder.length < 2 || holder.length > 20) return "예금주는 2~20자로 입력하세요.";
  return { bank, account, holder };
}

// param: v {name, phone, address, memo}. return: 정리된 배송지, 잘못되면 오류 문구
export function parseShipTo(v: unknown): { name: string; phone: string; address: string; memo: string } | string {
  const o = (v ?? {}) as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone.replace(/[^\d]/g, "") : "";
  const address = typeof o.address === "string" ? o.address.trim() : "";
  const memo = typeof o.memo === "string" ? o.memo.trim() : "";
  if (name.length < 2 || name.length > 20) return "받는 분 이름은 2~20자로 입력하세요.";
  if (!/^01\d{8,9}$/.test(phone)) return "휴대폰 번호를 확인해 주세요.";
  if (address.length < 8 || address.length > 200) return "주소를 정확히 입력하세요.";
  if (memo.length > 60) return "배송 메모는 60자 이하로 적어 주세요.";
  return { name, phone, address, memo };
}

export const CARRIERS = ["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배", "CU편의점택배", "GS편의점택배", "경동택배", "기타"] as const;
// param: carrier, tracking. return: 오류 문구 또는 null
export function shipInputProblem(carrier: unknown, tracking: unknown): string | null {
  if (typeof carrier !== "string" || !(CARRIERS as readonly string[]).includes(carrier)) return "택배사를 골라 주세요.";
  if (typeof tracking !== "string" || !/^[0-9A-Za-z-]{6,30}$/.test(tracking.trim())) return "송장번호를 확인해 주세요.";
  return null;
}
