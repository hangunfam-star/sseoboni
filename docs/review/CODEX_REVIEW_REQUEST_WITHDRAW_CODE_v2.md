프로젝트: 써보니
작성자: Claude Code
요청서 번호: REQ-써보니-20261026-2205 · 작성 일시: 2026-10-26 22:05:02 KST
기준 지시: 2026-10-26 Codex 코드 검수 FAIL(ORD-써보니-20261026-212731, 대응 REQ-써보니-20261026-2118) · 버전: v2(탈퇴 기능 1단계 코드 다시 검수 요청서) (이전 v1) · 이전 버전과 같은지: 일부 다름
일의 크기: 중 — 운영에서는 꺼진 채로 들어가고, 운영 데이터 쓰기·삭제 없음
왕복: 2/3 · 막는 문제 이전 2건 → 지금 0건(자체 확인 기준)

# Codex 다시 검수 요청 — 탈퇴 기능 1단계 코드

## 유형별 전수 점검 표
| 유형 이름 | 찾은 곳 | 고친 곳 | 남은 곳 |
|---|---|---|---|
| 1 인증 실패를 성공으로 표시 | WithdrawForm 401 처리. 같은 유형 전수: 탈퇴 API 응답을 해석하는 곳 1곳(WithdrawForm)뿐 | 서버가 유효한 쿠키의 주인이 이미 탈퇴했는지 확인해 200 {already:true}, 그 밖은 401 "로그인이 끝났어요"(app/src/lib/session.ts sessionUserWithdrawn, app/src/app/api/me/withdraw/route.ts). 화면은 2xx만 완료 | 0 |
| 2 시험 실패가 성공 종료로 숨음 | run_withdraw_regress.sh. 같은 유형 전수: 새로 만든 실행 파일 2개(run_withdraw_regress.sh, run_withdraw_tests.sh) | 두 파일 모두 failed 누적, T10이 503/503이 아니면 실패, 마지막 exit 1 | 0 |
| 3 확인 문구 trim | WithdrawForm 비교·전송 | 원문 그대로 비교·전송. API는 원래부터 정확히 일치만 허용 | 0 |
| 4 알림 id 선조회 | withdraw.ts P7 | 바꿀 알림 id를 먼저 모은 뒤 `notifications.id IN (...)`으로만 갱신 | 0 |
| 5 시험 반례 부족 | T1·T2·T5·T6·T9·T13·T14·T15 | 아래 표 | 0 |

| 시험 | 보강 내용 |
|---|---|
| T1 | 30일 전 후기 → 상대 판매자 채널 후기 탭에서 탈퇴 전 닉네임 보임, 탈퇴 뒤 0건·"탈퇴한 사용자". 탈퇴 전 쿠키를 그대로 다시 써도 비로그인 |
| T2 | 정확히 168시간=막힘, 168시간+1ms=통과(withdraw_unit.ts, 경계 함수 inDisputeWindow 분리), 서버 경유 ±5초 |
| T5 | 같은 쿠키로 동시에 POST 2개(스레드) → 하나 ok, 하나 already, withdrawn_at 1번 |
| T6 | 409 뒤 이미 있던 채팅 알림의 제목·본문·읽음 그대로. 9일 전 끝난 거래에 상대가 후기 저장 201, 탈퇴자 알림 0 |
| T9 | 맞는 확인 문구 + 남의 userId → 요청한 본인만 탈퇴, 남은 그대로. 앞뒤 공백 문구 400 |
| T11 | 세션이 끊긴 뒤 누르면 오류 문구가 나오고 "탈퇴가 끝났어요"가 안 나옴, 계정 ACTIVE. 앞뒤 공백이면 버튼 꺼짐 |
| T13 | 표 17개 전체 줄 수 + 8개 표의 탈퇴자 줄 + 알림 본문 전체 + 통계 id 전체 + 사용자·상품·제안을 오류 전후로 비교 |
| T14 | 탈퇴자가 낸 CANCELLED·EXPIRED, 탈퇴자 상품의 CANCELLED·EXPIRED → 상태 그대로, 글만 비움 |
| T15 | 탈퇴자 통계 n줄이 같은 가명 하나로 바뀌고 그 가명 줄 수 = n, 다른 사용자 통계 줄(id, user_id)은 그대로 |

## 실제 실행 결과(Claude, 2026-10-26)
| 시험 | 결과 |
|---|---|
| `bash ops/e2e/run_withdraw_tests.sh`(PC 1280px → 모바일 375px·iPhone UA·터치 → 오류 주입 → 단위) | pc 52/52, m 52/52, fault 4/4, 단위 실패 0, 스크립트 종료코드 0 |
| 같은 스크립트, 수정 전(첫 실행: 후기 공개 기간·재로그인 처리·단위 경로 문제) | 종료코드 1, SUMMARY failed=3 → 스크립트가 실패를 종료코드로 드러냄을 확인 |
| 고친 화면을 일부러 옛 코드(401을 완료로 처리)로 되돌려 PC 시험 | T11 세션 끊김 단계에서 실패(오류 문구가 나오지 않음) → 되돌린 뒤 통과. 이 시험이 결함 1을 잡는다 |
| `bash ops/e2e/run_withdraw_regress.sh` | T10 503/503, test_checks·test_checks_fix·test_logout·test_nicklock 종료코드 0, 단위 pass 50 fail 0, failed=0 |
| legacy/test_notify.py | 회귀 스크립트에서 뺐다. 점검표 필수화(5cffc23) 이전 시험이라 상품 등록에서 멈춤(탈퇴와 무관). 알림 회귀는 10명 시뮬레이션 108/108(알림 8단계 포함)로 확인 |
- 스크린샷: E:\PROJECTS\04_써보니\ops\e2e\.out\shots\withdraw_{pc,m}_{form,done,expired,other_chat,reserved_nick}.png

## 검수 항목
1. 1차 막는 문제 2건·고쳐야 할 문제 3건이 풀렸는가(ⓐⓑⓒ 구분)
2. 새로 생긴 결함이 있는가(sessionUserWithdrawn이 다른 곳의 인증을 바꾸지 않는가 포함)
3. 실제 브라우저: 격리 서버는 Claude가 `WITHDRAW=1`로 띄워 둔다(http://localhost:3200). 브라우저 실행이 막히면 화면 글자·응답 코드를 근거로 적어 달라

## 금지
운영 서버·운영 DB 접근, 비밀값 출력, 파일 수정·커밋

## 보고 형식
머리말(대응 요청서 REQ-써보니-20261026-2205, 판정 PASS/FAIL), 지적마다 등급·ⓐⓑⓒ·근거 파일:행·수정안
