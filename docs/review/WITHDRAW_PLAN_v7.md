프로젝트: 써보니
작성자: Claude Code
번호: PLAN-써보니-20261026-2047 · 작성 일시: 2026-10-26 20:47:33 KST
기준 지시: 2026-10-26 20:4x 사용자 "a"(Codex 3차 결과의 선택 A: 6건 반영 뒤 4차 검수 없이 개발, 코드는 Codex가 검수) · 버전: v7(탈퇴 기능 1단계 개발 확정 계획, Codex 3차 지적 6건 반영) (이전 v6) · 이전 버전과 같은지: 일부 다름
일의 크기: 중 — 운영에서는 꺼진 채로 들어가고, 운영 데이터 쓰기·삭제 없음
왕복: 3/3 끝 · 계획 검수는 더 하지 않음(63절(검수 왕복 3번)). 3차 막는 문제 6건을 이 판에 반영, 완성 코드를 Codex가 검수

# 탈퇴 기능 1단계 계획 v7(개발 확정판)

## 00. Codex 3차 지적 6건 처리
| 지적 | 처리 |
|---|---|
| 1 탈퇴 전 주문 자동 진행(advanceOrders)이 따로 저장됨 | 탈퇴 요청에서 advanceOrders를 부르지 않는다. 트랜잭션 안에서 지금 상태만 읽고 판정한다. 기한이 지났지만 아직 자동 처리 전인 주문도 막는 거래로 보이고, 화면에 "자동 처리 대기 중이면 10분쯤 뒤 다시 시도해 주세요"라고 안내한다(정기 작업 주기 10분, app/src/lib/jobs.ts:105). 그래서 탈퇴 요청이 남기는 변경은 탈퇴 트랜잭션 하나뿐이다 |
| 2 완료 거래의 제안을 CANCELLED로 바꿈 | 상태를 바꾸는 대상은 PENDING, 그리고 어떤 주문의 proposal_id(app/src/lib/orders.ts:198)에도 쓰이지 않은 ACCEPTED만. 주문에 쓰인 제안은 상태를 그대로 둔다. 글(message·seller_reply) 비우기는 상태 변경과 따로, 탈퇴자가 쓴 것은 모두 |
| 3 확인서에 표별 반례 기록 없음 | SELF_REVIEW_WITHDRAW_PLAN_v7.md에 4개 표별 검토 범위·반례 시도 수·발견 수·근거·조치를 적는다 |
| 4 시험 실행 명령 미완성 | 7절 T10·T12를 정확한 명령·인자·기대 결과로 바꾸고, 알림 회귀(legacy/test_notify.py pc·m)와 test_withdraw.py PC·모바일 실행을 넣는다. 스위치 값 6가지(없음·0·false·true·yes·1) |
| 5 알림을 고칠 때 원래 값이 먼저 지워짐 | 트랜잭션 처음에 원래 닉네임, 대상 제안 id·답글, 바꿀 알림 id를 먼저 읽어 둔다. 실행 순서는 P7(알림) → P6(제안) → P3(이름) |
| 6 판매자 탈퇴 알림 주소가 404 | 새 알림 고정: category TRADE, title `써보기 제안 취소 · <상품 제목>`, body `판매자가 탈퇴해 제안이 취소됐어요.`, url `/me`(보낸 제안 목록이 있는 화면, app/src/app/me/page.tsx:56), dedupeKey `withdraw-proposal-<제안 id>`. T14에서 알림을 눌러 /me가 열리는지 확인 |

아래 본문은 v6(탈퇴 기능 1단계 계획) 내용이다. 위 표와 다르면 위 표가 우선한다. 바뀐 곳은 P1·P2·P6과 T10·T12·T13·T14에 반영했다.

참조 규칙: E:\PROJECT_CONTROL_CENTER\00_공통\PLANNING_RULES_v3.md, 38절(기획 규칙 6단계), 55절(한계는 착수 전에 말하기), 63절(검수 왕복 3번), 65절(기획 3단계), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만).
두 단계로 나눈 이유와 2단계 범위는 v5 0절·10절 그대로다. Codex 2차 결과도 이 분리를 "조건부 타당"으로 판정했다.

## 0. Codex 2차 지적 처리표 (유형별 전수)
| 유형 이름 | 찾은 곳 | 고친 곳 | 남은 곳 |
|---|---|---|---|
| 1 기능 스위치 판정·시험 환경 켜기 | 판정식 없음, 격리 실행기 2개(ops/e2e/run_isolated.sh, E:\PROJECTS\_work\04_써보니\sim_20261024\serve_sim.sh)에 켜는 경로 없음 | 2절 P0, 3절(실행기 2개 추가), T10 | 0 |
| 2 막는 조건이 실제 분쟁 규칙과 다름 | P1, T2 | 2절 P1, T2(168시간 경계·completed_at 없음·CANCELLED) | 0 |
| 3 처리 순서·전부 롤백·두 번째 응답 | P1·P2 순서, T5, 실패표 | 2절 P2(7단계 순서), T5, T13(중간 오류 주입) | 0 |
| 4 관련 없는 사람의 알림을 바꿀 위험 | P7 본문 일치만. 같은 유형 전수: 탈퇴 처리가 다른 사람 행을 바꾸는 곳 3곳(알림 P7, 남의 제안 P6, 통계 P9) | P7을 수신자·URL·본문 3조건으로 좁힘. P6은 탈퇴자 상품의 제안 id로만, P9는 탈퇴자 user_id 행으로만 한정. T7·T14 | 0 |
| 5 v5용 독립 검토 확인서 없음 | 확인서는 v3용뿐 | SELF_REVIEW_WITHDRAW_PLAN_v6.md 새로 작성 | 0 |
| 고쳐야 할 문제 4-1 RESERVED | P5 | P5에 RESERVED 추가, T3 4상태 | 0 |
| 고쳐야 할 문제 4-2 시험 빈칸 | P6·P8·P9·P10, 모바일 UA·터치, 회귀 명령, 0018 적용 | T3·T6·T9·T11·T12·T15·T16 | 0 |
| 작은 문제: 요청서 번호 형식 | Codex는 "REQ-04-…"를 기준으로 봄 | 현행 52절(구분 번호와 매칭)은 2026-10-23 개정(2)으로 "REQ-<프로젝트명>-YYYYMMDD-HHMM"이다. 그대로 둔다 | 0 |
| 작은 문제: 머리말 | 프로젝트·작성자 한 줄 | 이 판부터 두 줄로 나눔 | 0 |

## 1. 완성 정의 (v5와 같음)
- 시험 서버에서 MY → 정산 계좌 화면 맨 아래 "탈퇴하기"로 탈퇴한다. 탈퇴하면 로그인할 수 없고, 상대방 화면과 채팅 알림에는 "탈퇴한 사용자"로 보인다.
- 거래 기록은 그대로 둔다. 분리 보관은 2단계에서 한다.
- 운영에서는 꺼진다.

## 2. 정책
| # | 결정 |
|---|---|
| P0 | 기능 스위치: 서버 전용 함수 `withdrawEnabled()`가 `process.env.WITHDRAW_ENABLED === "1"`일 때만 참이다. 값이 없거나 "0"·"false"·"true"·"yes"이면 꺼짐이다. GET·POST API는 로그인 확인·본문 읽기보다 먼저 이 함수를 보고, 꺼져 있으면 503을 돌려준다. AccountPage(서버 화면)도 같은 함수로 폼을 그릴지 정한다. 운영 서버 컨테이너에는 이 변수가 없다(2026-10-26 환경변수 이름 실측, 두 번 확인: ADMIN_CHAT_VIEW·KAKAO 조회 때 목록에 없음) |
| P0-2 | 시험 환경 켜기: run_isolated.sh는 `WITHDRAW=1 bash ops/e2e/run_isolated.sh`일 때만 서버에 WITHDRAW_ENABLED=1을 넘긴다. 기본은 꺼짐이다. 시뮬레이션 서버(serve_sim.sh)는 시험 전용이라 항상 켠다. 이 서버는 0.0.0.0으로 열려 Tailscale에서 접속되지만 시뮬레이션 복사 DB(sim.db)만 쓴다 |
| P1 | 막는 조건(내가 구매자나 판매자인 주문 기준): ① FINAL_STATUSES 밖 ② 그 주문의 OPEN 분쟁 ③ PURCHASED·RETURNED 중 completed_at이 없거나 완료 뒤 168시간(7×24) 이하. CANCELLED는 ③에서 뺀다(app/src/lib/orders.ts:594가 취소 거래의 분쟁을 막으므로 분쟁 가능 기간이 없다) |
| P2 | 처리 순서(advanceOrders는 부르지 않음): ① 트랜잭션 시작 ② 사용자 ACTIVE 확인과 P1 확인 ③ 막히면 아무것도 쓰지 않고 409 ④ 조건부 `ACTIVE → WITHDRAWN`(바뀐 줄 1이 아니면 {already:true}) ⑤ 원래 닉네임·대상 제안 id와 답글·바꿀 알림 id를 읽어 둠 ⑥ P7 → P6 → P3 → P4 → P5 → P8 준비 → P9 ⑦ 한 번에 커밋. 비동기 작업은 넣지 않는다. 어느 단계에서 예외가 나도 전체 롤백된다 |
| P2-2 | 두 번째 요청의 응답: 동시에 두 번 오면 한 건만 반영된다. 두 번째 응답은 도착 시점에 따라 {already:true}(트랜잭션 ⑤에서 걸림) 또는 401(로그인 확인에서 걸림)이다. 화면은 두 경우 모두 "탈퇴가 끝났어요"로 보여 준다 |
| P3 | 이름 가리기: nickname="탈퇴한 사용자", kakao_image_url=null, show_photo=0, withdrawn_at=지금. 주문의 입금자명(app/src/lib/orders.ts:199, 닉네임 앞 4글자+숫자)은 거래 기록이라 1단계에서 그대로 두고 2단계에서 처리한다 |
| P4 | 바로 삭제(탈퇴자 user_id 행만): social_accounts, login_links, seller_accounts, wishlists, demand_intents, notifications, push_subscriptions, notification_prefs |
| P5 | 상품(탈퇴자가 판매자인 것만): ACTIVE·HIDDEN·RESERVED → REMOVED, SOLD는 그대로 |
| P6 | 제안: ① 탈퇴자가 구매자인 제안 ② 탈퇴자 상품의 제안. 둘 중 PENDING과 주문에 쓰이지 않은 ACCEPTED만 CANCELLED로 바꾼다. 주문에 쓰인 제안은 상태를 그대로 둔다. ②에서 취소된 것은 구매자에게 00절 6번의 고정 알림을 보낸다. 탈퇴자가 쓴 글(①의 message, ②의 seller_reply)은 상태와 상관없이 비운다 |
| P7 | 상대 알림(3조건이 모두 맞는 행만): 채팅은 수신자=탈퇴자가 들어 있는 각 방의 상대, url=`/chats/<그 방 id>`, body=`<탈퇴자 원래 닉네임>님이 메시지를 보냈어요.` → `탈퇴한 사용자님이 메시지를 보냈어요.`. 제안 거절은 수신자=②의 구매자, url=`/listings/<그 상품 id>`, body=`판매자가 제안을 거절했어요. "<그 제안의 seller_reply>"` → `판매자가 제안을 거절했어요.`. 본문만으로 전체 표를 바꾸지 않는다. 닉네임이 없던 사람의 알림 본문은 `상대님이 메시지를 보냈어요.`(채팅 API 55행의 기본값)라 이름이 들어 있지 않으므로 바꾸지 않는다 |
| P8 | 탈퇴자에게: 상대가 채팅을 보내면 409. 이 확인은 메시지를 넣고 notifyTx를 부르기 전에 한다(메시지·알림 모두 0줄 증가, 이미 있던 안 읽은 알림도 그대로). notifyTx는 수신자가 ACTIVE가 아니면 쓰지 않는다. 후기 작성 기간(14일, app/src/ui/trade-rules.ts:62)이 막는 기간(7일)보다 길다. 8~14일째에 탈퇴한 사람에게 상대가 후기를 쓰는 것은 허용하고, 탈퇴자에게 가는 알림만 막는다 |
| P9 | 통계: market_validation_events 중 user_id가 탈퇴자인 행만 `wd_`+16바이트 hex 가명 하나로 바꾼다 |
| P10 | 재가입·예약 닉네임: 같은 카카오로 로그인하면 새 계정. 닉네임에서 모든 공백을 지운 값이 "탈퇴한사용자"이면 거절한다(cleanNickname, 카카오 닉네임으로 가입하는 경로도 같은 함수를 지나는지 개발 때가 아니라 지금 확인: 3절 확인 기록) |
| P11 | 확인 문구 "탈퇴합니다"가 정확히 일치해야 실행 |

## 3. 파일과 계획 단계 확인 기록
| 파일 | 상태 |
|---|---|
| app/drizzle/0018_withdraw.sql + meta(journal·snapshot) | 신규: users.withdrawn_at 1칸 |
| app/src/db/schema.ts | 수정 |
| app/src/lib/withdraw.ts | 신규: withdrawEnabled, blockersOf, withdrawUser |
| app/src/app/api/me/withdraw/route.ts | 신규 |
| app/src/app/me/account/WithdrawForm.tsx, page.tsx | 신규·수정 |
| app/src/lib/notify.ts | 수정 |
| app/src/app/api/chats/[id]/route.ts | 수정 |
| app/src/lib/session.ts | 수정 |
| ops/e2e/run_isolated.sh | 수정: WITHDRAW=1 매개변수 |
| ops/e2e/suites/test_withdraw.py | 신규 |
| (작업 폴더) sim_20261024/serve_sim.sh | 수정: WITHDRAW_ENABLED=1 |

- 계획 단계 확인: 카카오 닉네임 가입 경로. app/src/lib/kakao.ts:118에서 받은 닉네임이 가입 완료 때 cleanNickname을 거치는지 개발 첫날 확인하지 않고, 이 판을 내기 전에 확인해 SELF_REVIEW_WITHDRAW_PLAN_v6.md 3절에 적는다.

## 4. 설계–코드 대조표
| 설계 문장 | 호출 함수(파일:행) | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴하면 로그인 불가 | app/src/lib/session.ts:53 `getCurrentUserId` | users | 없음 | 충돌 없음 |
| 탈퇴 시 쿠키 지움 | app/src/app/api/session/route.ts:58 `DELETE`와 같은 처리 | 없음 | 없음 | 충돌 없음 |
| 진행 중 거래 판정 | app/src/ui/trade-rules.ts:14 `FINAL_STATUSES`로 지금 상태만 읽음. app/src/lib/orders.ts:452 `advanceOrders`는 부르지 않음(자체 트랜잭션으로 먼저 저장하기 때문) | orders, disputes | 없음 | 충돌 후 해소: 기한 지난 주문도 막는 거래로 보이고, 10분 주기 정기 작업이 처리한 뒤 다시 시도하게 안내 |
| 주문에 쓰인 제안 보존 | app/src/lib/orders.ts:198이 주문에 proposal_id를 기록 → 그 id의 제안은 상태 변경에서 뺌 | orders, trial_proposals | trial_proposals | 충돌 없음 |
| 분쟁 가능 기간 | app/src/lib/orders.ts:594(취소 거래 분쟁 불가), app/src/lib/orders.ts:595(완료 뒤 168시간) | orders | 없음 | 충돌 없음 |
| 탈퇴 처리 | 신규 `withdrawUser`(동기 트랜잭션, P2 순서) | users, orders, disputes, listings, trial_proposals, chat_threads | P3~P9의 표 | 충돌 없음 |
| 판매자 쪽 새 주문 막기 | app/src/lib/orders.ts:193 조건부 예약 update | listings | listings | 충돌 없음 |
| 상대 알림 줄 바꿈 | app/src/lib/notify.ts:40 `notifyTx`로 쓴 줄 중 P7 3조건 행만 | notifications, chat_threads, trial_proposals | notifications | 충돌 없음 |
| 탈퇴자에게 알림 안 씀 | app/src/lib/notify.ts:40 `notifyTx`에 ACTIVE 확인 | users | notifications | 충돌 없음 |
| 재가입 새 계정 | app/src/lib/kakao.ts:126 `userOfKakao` | social_accounts | users | 충돌 없음 |
| 이름 가리기 | app/src/lib/chat.ts:50, app/src/lib/reviews.ts:105 | users | users | 충돌 없음 |
| 예약 닉네임 | app/src/lib/session.ts:31 `cleanNickname` | 없음 | 없음 | 충돌 없음 |
| 탈퇴 화면 | app/src/app/me/account/page.tsx:15 `AccountPage` | users, orders | 없음 | 충돌 없음 |

## 5. 외부 서비스 근거표
| 항목 | 공식 문서 주소 | 확인한 문장 | 확인일 | 상태 |
|---|---|---|---|---|
| 개인정보 파기 원칙 | https://www.law.go.kr/법령/개인정보보호법/제21조 | 다른 법령에 따라 보존하여야 하는 경우에는 그러하지 아니하다 | 2026-10-26 | 확인 |
| 거래기록 보존 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 계약 또는 청약철회 등에 관한 기록: 5년 | 2026-10-26 | 확인 |
| 1단계를 운영에서 켜도 되는지 | 해당 없음 | 분리 보관(시행령 제6조 제2항 제3호)을 1단계는 하지 않는다 | 2026-10-26 | 미확인 — 개발 범위 제외. 그래서 운영에서는 끈다(P0) |

## 6. 값 출처표
| 값 | 출처구분 | 근거 |
|---|---|---|
| 분쟁 가능 기간 168시간 | 실측 | app/src/lib/orders.ts:595 `7 * 24` |
| 확인 문구 "탈퇴합니다" | 사용자 지시 | "스스로 판단해서 적용" 위임 |
| 가명 16바이트 | 사용자 지시 | 같음 |

## 7. 시험 (정책·합격 기준 연결)
| 번호 | 시험 | 틀린 입력·실패 확인 | 정책 |
|---|---|---|---|
| T1 | 탈퇴 → 쿠키를 다시 써도 비로그인. 상대의 채팅·후기·채팅 알림에 원래 닉네임 0건(주문의 입금자명 칸은 P3에 따라 검사에서 뺀다) | 탈퇴 전에는 같은 확인이 원래 닉네임을 1건 이상 찾는다 | P3 |
| T2 | 막는 조건: 진행 중 거래 409. PURCHASED 완료 뒤 167시간 59분 막힘, 정확히 168시간 막힘, 168시간 1초 통과. completed_at 없음 막힘. CANCELLED(분쟁 없음)는 1시간 전 완료여도 통과. OPEN 분쟁은 막힘 | 경계 직전·직후 | P1 |
| T3 | 판매자 탈퇴: ACTIVE·HIDDEN·RESERVED 상품이 REMOVED, SOLD는 그대로 | 탈퇴 전 4상태를 준비 | P5 |
| T4 | P4의 8개 표에 탈퇴자 줄 0, 다른 사용자 줄 수는 그대로 | 탈퇴 전 각 표의 탈퇴자 줄 1 이상을 먼저 센다 | P4 |
| T5 | 동시 탈퇴 2개: withdrawn_at 1번만, 두 번째 응답은 already 또는 401 | - | P2-2 |
| T6 | 상대가 탈퇴자에게 채팅 → 409, chat_messages·notifications 줄 수 증가 0, 이미 있던 안 읽은 채팅 알림의 제목·본문 그대로. 탈퇴 9일 전 끝난 거래의 상대가 후기를 쓰면 저장되고 탈퇴자 알림은 0 | - | P8 |
| T7 | 알림 격리: 탈퇴자와 같은 닉네임의 다른 사용자 2명(탈퇴 전에 닉네임을 같게 맞춤)과 같은 답글을 쓴 다른 판매자의 제안을 준비. 탈퇴 뒤 탈퇴자 관련 알림만 바뀌고 나머지는 0건 변경 | 닉네임이 "구매자"인 사람도 같이 시험 | P7 |
| T8 | 같은 카카오로 재가입 → 새 계정(id 다름) | - | P10 |
| T9 | 확인 문구 틀림 400. 남의 id를 본문에 넣어도 무시. 닉네임 "탈퇴한 사용자", "탈퇴한사용자", " 탈퇴 한 사용자 " 모두 거절 | 모두 틀린 입력 | P10, P11 |
| T10 | 스위치: 변수 없음·"0"·"false"·"true"·"yes"일 때 GET·POST 503, 버튼 없음. "1"일 때만 동작. 단위 시험(`withdrawEnabled` 6가지 값)과 실제 서버 2번(run_isolated.sh 기본 → 503, WITHDRAW=1 → 200)으로 확인 | 틀린 값 5가지 | P0 |
| T11 | 화면: PC 1280px, 모바일 375px(모바일 UA·is_mobile·has_touch 흉내). 탈퇴 화면 클릭·입력과 상대 화면. 스크린샷 경로 기록 | - | 전체 |
| T12 | 회귀(작업 폴더 E:\PROJECTS\04_써보니, Git Bash, WITHDRAW 없이 서버 시작). 각 묶음 전에 `bash ops/e2e/run_isolated.sh`로 서버를 다시 띄운다. D=`$(cygpath -w ops/e2e/.out/copy.db)`, S=`$(cygpath -w ops/e2e/.out/shots)`, L=`$(cygpath -w ops/e2e/.out/dev.log)`. ① `python ops/e2e/suites/test_checks.py $D $S` ② `python ops/e2e/suites/test_checks_fix.py $D $S` ③ `python ops/e2e/suites/test_logout.py $S` ④ `python ops/e2e/suites/test_nicklock.py $D $S $L` ⑤ `python ops/e2e/legacy/test_notify.py $D $S pc` ⑥ 같은 명령 `m` ⑦ app 폴더에서 `npx tsx --test src/ui/*.test.ts`. 합격 = 각 스크립트의 마지막 줄 실패 0, 단위 시험 fail 0. 탈퇴 시험: `WITHDRAW=1 bash ops/e2e/run_isolated.sh` 뒤 `python ops/e2e/suites/test_withdraw.py $D $S pc`와 `... m`(모바일 375px·UA·터치). 스크린샷은 $S 아래 withdraw_*.png | - | 회귀 |
| T13 | 중간 오류 주입: 시험 전용 변수 `WITHDRAW_FAULT=after_p6`(WITHDRAW_ENABLED=1이고 NODE_ENV가 production이 아닐 때만 읽음)로 P6 뒤 예외 → users·상품·제안·8개 표·알림·통계·주문·주문 기록·채팅 메시지 모두 탈퇴 전과 같음. 기한이 지난 AWAIT_PAYMENT 주문을 가진 사용자로 실행해 주문이 자동 처리되지 않았는지도 본다 | 오류 주입 | P2 |
| T14 | 제안 양쪽: 탈퇴자가 구매자인 제안(PENDING·ACCEPTED·DECLINED·CANCELLED·EXPIRED)과 탈퇴자 상품의 제안(같은 5상태). 상태 변경은 PENDING과 주문에 쓰이지 않은 ACCEPTED만, 완료 거래(168시간 지남)에 쓰인 ACCEPTED는 그대로, 글 비우기는 5상태 모두, 다른 상품의 제안은 변경 0. 취소 알림의 제목·본문·url·dedupeKey가 00절 6번과 같고, 구매자 화면에서 알림을 누르면 /me가 열림 | - | P6 |
| T15 | 통계: 탈퇴자 user_id 행 0건, `wd_` 가명 행 수 = 탈퇴 전 탈퇴자 행 수, 다른 사용자 행 변경 0 | - | P9 |
| T16 | 마이그레이션: app/dev.db의 복사본(운영 DB가 아님. run_isolated.sh가 만드는 copy.db)에 0018 적용 → 기존 행 수 그대로, 다시 실행해도 오류 없음. 운영 DB 적용 확인은 운영 반영(승인) 때 배포 스크립트의 백업 뒤 migrate로 한다 | - | 배포 안전 |

## 8. 실패·원복표
| 실패 | 처리 |
|---|---|
| 트랜잭션 안 어느 단계든 오류 | 전부 롤백(T13) |
| 막는 거래 | 아무것도 쓰지 않고 409 + 목록 |
| 이미 탈퇴·동시 요청 | P2-2 |
| 스위치 꺼짐 | 503 |

## 9. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 유지 |
|---|---|---|---|
| 코드 되돌림 | 없음(withdrawn_at 칸은 남음) | 없음(카카오 쪽은 건드리지 않음) | 탈퇴자는 WITHDRAWN이라 옛 코드에서도 로그인 불가 |

## 10. 보호 목록
- app/src의 기존 변경 4개(admin/page.tsx, admin/ChatLog.tsx, ui/trial-pricing.ts, ui/trial-pricing.test.ts)와 그 밖의 커밋 안 된 파일은 수정·정리·커밋하지 않는다. 탈퇴 커밋에는 3절 파일만 넣는다.
- 2단계 범위는 v5 10절 그대로다.
