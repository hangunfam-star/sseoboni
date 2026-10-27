프로젝트: 써보니
작성자: Claude Code
번호: 생략 · 작성 일시: 2026-10-26 20:49:00 KST
기준 지시: 2026-10-26 사용자 "a"(Codex 3차 선택 A) · 버전: v1(탈퇴 1단계 확정 계획 v7 독립 검토 확인서) · 이전 버전과 같은지: 처음
일의 크기: 중 — 검토 대상 계획서와 같은 크기

# 독립 검토 확인서 — WITHDRAW_PLAN_v7.md

## 1. 기계 점검
- 명령: `python -I -B E:\PROJECT_CONTROL_CENTER\00_공통\tools\plan_checks.py E:\PROJECTS\04_써보니\docs\review\WITHDRAW_PLAN_v7.md --root E:\PROJECTS\04_써보니`
- 실행 시각: 2026-10-26 20:48:24
- 출력: "결과: 통과", 종료코드 0

## 2. 4개 표별 반례 점검
| 표 | 검토 범위 | 반례 시도 수 | 발견 수 | 근거 파일:행 | 조치 |
|---|---|---|---|---|---|
| 설계–코드 대조표 | 13행 전부 | 16(각 행의 파일:행을 열어 실제 동작 확인 13, Codex 3차 지적 재현 3) | 3 | app/src/lib/orders.ts:452(자체 트랜잭션으로 먼저 저장), app/src/lib/orders.ts:198(주문에 proposal_id 기록), 계획 P2 순서(원래 닉네임을 먼저 지움) | advanceOrders 호출 제거, 주문에 쓰인 제안 보존, 원래 값 먼저 읽기 + P7→P6→P3 순서 |
| 외부 서비스 근거표 | 3행 | 3(law.go.kr 두 조문 원문 열람, 1단계 운영 불가 판단) | 0 | law.go.kr 개인정보보호법 제21조·전자상거래법 시행령 제6조(2026-10-26 열람) | 없음 |
| 값 출처표 | 3행 | 3(168시간을 코드와 대조, 확인 문구·가명 길이의 출처 확인) | 0 | app/src/lib/orders.ts:595 `7 * 24` | 없음 |
| 롤백 소실 목록 | 1행 | 2(옛 코드에서 WITHDRAWN 사용자 로그인 가능 여부, 카카오 쪽 상태가 바뀌는지) | 0 | app/src/lib/session.ts:53(ACTIVE만 통과), 1단계는 카카오 API를 부르지 않음 | 없음 |

## 3. 계획 단계 실측 기록(v6 확인서에서 이어짐)
- 카카오 닉네임 가입도 cleanNickname을 거친다: callback/route.ts:47, complete/route.ts:15
- app/dev.db에서 공백을 뺀 닉네임이 "탈퇴한사용자"인 사용자: 0명(2026-10-26 19:55)
- 보낸 제안 목록은 /me에 있다: app/src/app/me/page.tsx:56
- 정기 작업 주기 10분: app/src/lib/jobs.ts:105
- 시험 스크립트 인자: test_checks·test_checks_fix(DB, 캡처), test_logout(캡처), test_nicklock(DB, 캡처, 서버 로그), legacy/test_notify(DB, 캡처, pc|m). 각 파일 첫 줄 주석에서 확인

## 4. 확인하지 않은 것
- 계획 검수는 3번으로 끝났다(63절(검수 왕복 3번)). v7은 Codex가 다시 검수하지 않고, 완성된 코드를 Codex가 검수한다(사용자 선택 A).
