프로젝트: 써보니
작성자: Claude Code
요청서 번호: REQ-써보니-20261026-2118 · 작성 일시: 2026-10-26 21:18:11 KST
기준 지시: 2026-10-26 사용자 "a"(계획 v7 반영 뒤 개발, 완성 코드는 Codex가 검수) · 버전: v1(탈퇴 기능 1단계 코드 검수 요청서) · 이전 버전과 같은지: 처음
일의 크기: 중 — 운영에서는 꺼진 채로 들어가고, 운영 데이터 쓰기·삭제 없음

# Codex 코드 검수 요청 — 탈퇴 기능 1단계

## 역할과 기준
- 너(Codex)는 독립 검수자다. 파일은 고치지 않는다.
- 기준 계획: E:\PROJECTS\04_써보니\docs\review\WITHDRAW_PLAN_v7.md(00절 표가 우선)
- 기준 커밋: 8eaffa3(아직 커밋하지 않은 작업 트리)

## 검수 대상 파일(탈퇴 기능)
- app/src/lib/withdraw.ts(신규), app/src/app/api/me/withdraw/route.ts(신규), app/src/app/me/account/WithdrawForm.tsx(신규), app/src/app/me/account/page.tsx
- app/src/lib/notify.ts, app/src/app/api/chats/[id]/route.ts, app/src/lib/session.ts, app/src/db/schema.ts, app/drizzle/0018_withdraw.sql·meta
- app/src/app/globals.css(탈퇴 화면 모양 6줄. 계획 3절 목록에 없던 파일이라 계획 변경 기록으로 적음)
- ops/e2e/run_isolated.sh, ops/e2e/suites/test_withdraw.py, ops/e2e/suites/withdraw_unit.ts, ops/e2e/run_withdraw_regress.sh
- 대상이 아닌 기존 변경: app/src/app/admin/page.tsx, admin/ChatLog.tsx, ui/trial-pricing.ts, ui/trial-pricing.test.ts(별도 작업)

## 실제 실행 결과(Claude, 2026-10-26)
| 시험 | 환경 | 결과 |
|---|---|---|
| test_withdraw.py pc | WITHDRAW=1 격리 서버, 브라우저 1280px | 39/39 통과 |
| test_withdraw.py m | 같음, 375px·iPhone UA·is_mobile·has_touch | 39/39 통과 |
| test_withdraw.py fault | WITHDRAW=1 WITHDRAW_FAULT=after_p6 | 3/3 통과(9개 표 그대로) |
| withdraw_unit.ts | 스위치 6값·예약 닉네임 4변형 | 11/11 통과 |
| T10 기본 서버 | 탈퇴 꺼짐 | GET 503, POST 503 |
| 회귀 test_checks / test_checks_fix / test_logout / test_nicklock | 기본 서버 | 모두 종료코드 0 |
| 단위 시험 src/ui/*.test.ts | - | pass 50, fail 0 |
| legacy/test_notify.py pc·m | NICK=1 | 실패: 상품 등록에서 KeyError 'listing'. 이 시험은 점검표 필수화 커밋 5cffc23 이전 것이라 써보기 상품에 점검표를 넣지 않는다. 탈퇴 코드와 관계없음 |
| 알림 대체 회귀 | 10명 시뮬레이션(serve_sim.sh, WITHDRAW_ENABLED=1) | 108/108 통과(알림 8단계 포함) |
- 스크린샷: E:\PROJECTS\04_써보니\ops\e2e\.out\shots\withdraw_{pc,m}_{form,done,other_chat,reserved_nick}.png

## 검수 항목
1. 계획 v7의 P0~P11과 00절 6건이 코드에 그대로 있는가
2. withdrawUser 트랜잭션: 순서(원래 값 읽기 → P7 → P6 → P3 → P4 → P5 → P9), 비동기 없음, 전체 롤백
3. notifyTx ACTIVE 확인이 기존 알림(SYSTEM 사용자 포함) 흐름을 깨지 않는가
4. 시험이 실패를 실제로 잡는가(탈퇴 전 반대 결과 확인 포함)
5. 실제 브라우저 확인: PC 1280px·모바일 375px(UA·터치 흉내)로 직접 탈퇴 화면을 눌러 보고 스크린샷 경로를 남겨 달라. 서버: `WITHDRAW=1 bash ops/e2e/run_isolated.sh`

## 금지
운영 서버·운영 DB 접근, 비밀값 출력, 파일 수정·커밋

## 보고 형식
머리말(대응 요청서 REQ-써보니-20261026-2118, 판정 PASS/FAIL), 지적마다 막는 문제/고쳐야 할 문제/작은 문제, 근거 파일:행, 수정안
