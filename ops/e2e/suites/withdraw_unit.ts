// 탈퇴 1단계 단위 확인(T9·T10): 기능 스위치 값 6가지, 예약 닉네임 3가지 변형.
// 사용(app 폴더): DATABASE_URL=file:<복사 DB> npx tsx ../ops/e2e/suites/withdraw_unit.ts
import { inDisputeWindow, withdrawEnabled } from "@/lib/withdraw";
import { cleanNickname } from "@/lib/session";

let fail = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : detail); };
for (const [v, want] of [[undefined, false], ["0", false], ["false", false], ["true", false], ["yes", false], ["1", true]] as const) {
  if (v === undefined) delete process.env.WITHDRAW_ENABLED; else process.env.WITHDRAW_ENABLED = v;
  check(`T10 WITHDRAW_ENABLED=${v ?? "(없음)"} → ${want ? "켜짐" : "꺼짐"}`, withdrawEnabled() === want);
}
for (const n of ["탈퇴한 사용자", "탈퇴한사용자", " 탈퇴 한 사용자 ", "탈퇴한\t사용자"]) check(`T9 예약 닉네임 거절: "${n}"`, cleanNickname(n) === null);
check("T9 보통 닉네임은 통과(실패 확인의 반대)", cleanNickname("탈퇴하고싶다") === "탈퇴하고싶다");
// T2 경계: 정확히 168시간은 막힘, 1밀리초 넘으면 통과, 완료 시각 없음은 막힘, 취소는 기간과 상관없이 통과
const now = "2026-10-26T12:00:00.000Z";
check("T2 정확히 168시간 → 막힘", inDisputeWindow("PURCHASED", "2026-10-19 12:00:00", now) === true);
check("T2 168시간+1ms → 통과", inDisputeWindow("RETURNED", "2026-10-19T11:59:59.999Z", now) === false);
check("T2 completed_at 없음 → 막힘", inDisputeWindow("PURCHASED", null, now) === true);
check("T2 취소 1시간 전 → 통과", inDisputeWindow("CANCELLED", "2026-10-26 11:00:00", now) === false);
console.log(`== 실패 ${fail}`);
process.exit(fail ? 1 : 0);
