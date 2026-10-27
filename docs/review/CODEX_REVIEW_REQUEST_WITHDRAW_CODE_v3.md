프로젝트: 써보니
작성자: Claude Code
요청서 번호: REQ-써보니-20261027-0430 · 작성 일시: 2026-10-27 04:30:48 KST
기준 지시: 2026-10-26 Codex 코드 다시 검수 FAIL(ORD-써보니-20261026-221911, 대응 REQ-써보니-20261026-2205) · 버전: v3(탈퇴 기능 1단계 코드 마지막 다시 검수 요청서) (이전 v2) · 이전 버전과 같은지: 일부 다름
일의 크기: 중 — 운영에서는 꺼진 채로 들어가고, 운영 데이터 쓰기·삭제 없음
왕복: 3/3 · 막는 문제 이전 1건 → 지금 0건(자체 확인 기준)

# Codex 마지막 다시 검수 요청 — 탈퇴 기능 1단계 코드

63절(검수 왕복 3번)의 마지막 3번째 코드 검수다.

## 유형별 전수 점검 표
| 유형 이름 | 찾은 곳 | 고친 곳 | 남은 곳 |
|---|---|---|---|
| 탈퇴 뒤 로그인 화면 정보가 남음 | WithdrawForm 완료 처리. 같은 유형 전수: 탈퇴 성공을 처리하는 화면은 WithdrawForm 1곳 | 성공(200, already 포함)이면 `window.location.replace("/withdrawn")`로 문서 전체를 새로 불러옴. 새 공개 화면 app/src/app/withdrawn/page.tsx(로그인 정보를 읽지 않음). 화면 안 완료 상태(done)는 지움 | 0 |
| 서버 기동 실패를 실행기가 놓침 | run_withdraw_tests.sh, run_withdraw_regress.sh의 모든 run_isolated.sh 호출(T10 포함) | 공통 함수 `start()`가 run_isolated.sh 종료코드와 /login 200을 확인. 실패하면 그 묶음을 건너뛰고 failed 증가, 마지막 exit 1. 시험용 `START_FAIL=1` 스위치 | 0 |

## 실제 실행 결과(Claude, 2026-10-27)
| 시험 | 결과 |
|---|---|
| `bash ops/e2e/run_withdraw_tests.sh` | pc 54/54, m 54/54(375px·iPhone UA·is_mobile·has_touch), fault 4/4, 단위 실패 0, 종료코드 0 |
| T11 새 점검 | 탈퇴 전 화면에 계좌 정보·"계좌 삭제" 버튼·알림 수 있음 → 탈퇴 뒤 /withdrawn에서 계좌 정보·계좌 버튼·알림 수 0건, 이 브라우저 /api/session 비로그인 |
| `START_FAIL=1 bash ops/e2e/run_withdraw_regress.sh` | 종료코드 1, SUMMARY T10=START_FAIL … failed=5 |
| `START_FAIL=1 bash ops/e2e/run_withdraw_tests.sh` | 종료코드 1, SUMMARY pc·m·fault=START_FAIL failed=3 |
| `bash ops/e2e/run_withdraw_regress.sh`(1차 수정 뒤, 2026-10-26 22:04) | T10 503/503, 회귀 4묶음 종료코드 0, 단위 pass 50. 이번 수정(화면 이동·실행기)은 회귀 대상 화면과 겹치지 않아 다시 돌리지 않음 |
| tsc --noEmit, eslint(변경 파일) | 종료코드 0 |
- 스크린샷: E:\PROJECTS\04_써보니\ops\e2e\.out\shots\withdraw_{pc,m}_{form,done,expired,other_chat,reserved_nick}.png
- 참고: 2026-10-26 23:18 이 PC의 개발 캐시를 옮기다 better-sqlite3·sharp 패키지 파일이 지워졌고, 사용자 승인으로 같은 버전(12.11.1·0.35.4)을 다시 설치했다(package.json·잠금 파일은 바뀌지 않음). 근거: E:\PROJECTS\_work\reports\2026-10-26_써보니_개발환경_패키지_손상.md

## 검수 항목
1. 2차 지적 2건이 풀렸는가(ⓐⓑⓒ 구분)
2. 새로 생긴 결함이 있는가
3. 실제 브라우저: 격리 서버는 Claude가 `WITHDRAW=1`로 띄워 둔다(http://localhost:3200)

## 금지
운영 서버·운영 DB 접근, 비밀값 출력, 파일 수정·커밋

## 보고 형식
머리말(대응 요청서 REQ-써보니-20261027-0430, 판정 PASS/FAIL), 지적마다 등급·ⓐⓑⓒ·근거 파일:행·수정안
