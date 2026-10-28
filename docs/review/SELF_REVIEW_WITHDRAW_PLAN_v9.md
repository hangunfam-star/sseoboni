프로젝트: 써보니 · 작성자: Claude Code
번호: 생략 · 작성 일시: 2026-10-28 11:49:30 KST
기준 지시: 2026-10-28 사용자 "권장안"(탈퇴 2단계 진행) · 버전: v1(탈퇴 2단계 계획 v9의 자체 적대 검토 확인서) (이전 없음) · 이전 버전과 같은지: 처음
일의 크기: 대 — 대상 계획이 운영 DB 구조 변경과 법정 보관·파기를 다룸

# 자체 적대 검토 확인서 — WITHDRAW_PLAN_v9.md

## 관문 실행
- `python -I -B E:\PROJECT_CONTROL_CENTER\00_공통\tools\plan_checks.py docs\review\WITHDRAW_PLAN_v9.md --root E:\PROJECTS\04_써보니`
- 출력: `[plan_checks] docs\review\WITHDRAW_PLAN_v9.md / 결과: 통과`, exit=0 (2026-10-28 11:48:53 KST)

## 적대 검토
- 검토자: 보조 검토자(reviewer, 읽기 전용, Bash 금지). 대상은 v8(초판)이었다.
- 고정 점검표 7항목: 미룬 항목, 트리거 부작용, 상태기계, 전수표 누락, 결정 대조, 시험 강도, 확인하지 않은 것.
- 결과: 막는 문제 3건, 참고사항 9건.

| 지적 | 근거(검토자) | 조치(v9) |
|---|---|---|
| 막는 1 REPLACE 덮어쓰기 | 2절·3절 cancel_reason | INSERT OR IGNORE, 키에 탈퇴자 id, 빈 값 안 옮김 |
| 막는 2 동시 실행 | photos.ts:40-49 비동기 | 처리 중 표시(stage RETAINING, 5분) |
| 막는 3 원본 사진 없음 영구 정지 | 14절 누락 | missing=1 후 진행, T17f |
| 참고 1~9 | 검토 보고 | v9 00절 표대로 모두 반영 |

## 검토자가 놓친 것 중 작성자가 추가로 찾은 것
- SYSTEM 채팅 본문에 메모 원문이 들어가는 곳: orders.ts:80, orders.ts:365. v9 3절에 추가했다.

## 확인하지 않은 것
- v9 수정분 자체를 다시 적대 검토하지 않았다. Codex 계획 검수가 이를 맡는다.
