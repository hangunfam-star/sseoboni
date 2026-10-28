프로젝트: 써보니 · 작성자: Claude Code
요청서 번호: REQ-써보니-20261028-2146 · 작성 일시: 2026-10-28 21:46:18 KST
기준 지시: 2026-10-28 20:0x 사용자 "진행"(탈퇴 2단계 v12 개발) · 버전: v1(탈퇴 2단계 완성 코드 첫 검수 요청) (이전 없음) · 이전 버전과 같은지: 처음
일의 크기: 대 — 운영 DB 트리거·표 추가, 거래 기록 이동·파기 코드

# 탈퇴 2단계 코드 검수 요청 (1/3)

## 역할·금지
읽기 전용 코드 검수. 이 요청은 78절(Codex·Claude 직접 주고받기)에 따라 scripts/codex_ask.sh로 직접 전달된다. 매칭 확인은 머리말 한 줄로 쓰고, "진행" 승인을 기다리지 말고 같은 답변에서 바로 검수를 끝내라.
코드·DB·파일·git 변경, 운영 서버 접속, 시뮬레이션 DB(E:\PROJECTS\_work\04_써보니\sim_20261024\sim.db) 쓰기 금지. 시험을 돌리고 싶으면 E:\PROJECTS\_work\04_써보니\withdraw2_test\run_unit.ps1(사본 DB만 씀)만 실행해도 된다.

## 기준
- 1단계 커밋 f25a1d7 위의 작업트리 변경(미커밋). 설계: docs/review/WITHDRAW_PLAN_v12.md(00000절 > 0000절 > 000절 > 본문 우선).
- 검수 대상 파일(이 목록만): app/drizzle/0019_withdraw2.sql, app/drizzle/meta/_journal.json, app/drizzle/rollback/0019_down_triggers.sql, 0019_down_full.sql, app/src/db/schema.ts, app/src/db/client.ts, app/src/lib/retain.ts, app/src/lib/withdraw.ts, app/src/lib/photos.ts, app/src/lib/jobs.ts, app/src/lib/photo-url.ts, app/next.config.ts, app/src/app/api/me/withdraw/route.ts, app/src/app/api/photos/[file]/route.ts, app/src/app/api/listings/[id]/photos/route.ts, app/src/app/api/orders/[id]/photos/route.ts, app/src/app/withdrawn/page.tsx, app/src/app/me/account/WithdrawForm.tsx, ops/withdraw2_rollback.cjs, ops/backup_prune.sh, ops/e2e/run_isolated.sh(RETAIN_SECRET 줄), ops/e2e/suites/withdraw2_unit.ts, ops/e2e/suites/test_withdraw2_screen.py, ops/e2e/run_withdraw2_screen.sh
- 작업트리에 있는 다른 변경(app/src/app/admin/page.tsx, ChatLog.tsx, app/src/ui/trial-pricing*.ts, 시안 png 등)은 이번 범위 밖이다.

## Claude 실제 실행 결과(재현 근거)
| 시험 | 결과 | 로그 |
|---|---|---|
| 단위(withdraw2_unit.ts, 사본 DB) | 114 통과 / 0 실패. 두 줄(입금자명 비우기·WAL 확인)을 뺀 상태에서는 8건 실패를 확인 | E:\PROJECTS\_work\04_써보니\withdraw2_test\unit2.log |
| tsc --noEmit | 오류 0 | 같은 폴더 tsc.log |
| 1단계 탈퇴 화면 PC / 모바일 / 오류 주입 / 단위 | 58/0, 58/0, 4/0, 통과 | ops/e2e/.out/withdraw_tests.log, withdraw2_screen.log |
| 새 화면 시험 PC 1280 / 모바일 375(UA·터치) | 11/0, 11/0 | ops/e2e/.out/withdraw2_screen.log, 스크린샷 ops/e2e/.out/shots/w2_* |

## 판정 기준 (93절(개발 전 의견 보고 후 진행) 4항)
- 차단 오류만 막는다: 실행 불가, 데이터 손상·손실(법정 보관값 손실·조기 파기 포함), 개인정보가 지워져야 할 곳에 남음, 보안 사고, 되돌릴 수 없는 결과. 근거 파일:행과 고칠 방법을 함께.
- 나머지는 참고사항 표(항목·영향·권장 시점). 합격 판정에 넣지 않는다.

## 특히 볼 것
1. retain.ts·withdraw.ts의 상태기계(lease_owner·fence·WIPE_PENDING·purge_runs)가 설계 00000절·0000절과 같은가, 단계 사이 종료·동시 실행에서 손실·중복·영구 정지가 없는가.
2. 0019 트리거가 탈퇴하지 않은 사용자의 정상 쓰기를 막는 경로(쓰기 호출 목록 docs/review/survey/withdraw2_write_calls.txt 기준).
3. 사진 경로: staging→INSERT→rename, 공개 사진 404·304 순서, 고아 정리가 정상 사진을 지우지 않는가.
4. 키 파일 생성(fsync·link·key_registry)과 파기 순서(백업 정리 → 실제 파기)가 설계대로인가.
5. 단위 시험이 위험을 실제로 실패시킬 수 있는가(약한 단정).

## 보고 형식
머리말(대응 요청서: REQ-써보니-20261028-2146) → 판정(합격/불합격, 차단 수) → 차단 오류 표 → 참고사항 표 → 확인하지 않은 것.
