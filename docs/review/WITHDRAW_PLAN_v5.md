프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261026-1941 · 작성 일시: 2026-10-26 19:41:30 KST
기준 지시: 2026-10-26 사용자 "탈퇴 기능 개발" + "스스로 판단해서 적용" · 버전: v5(탈퇴 기능 1단계 계획 — 시험 서버용 핵심 탈퇴) (이전 v4 전체 설계) · 이전 버전과 같은지: 다름
일의 크기: 중 — 운영에서는 꺼진 채로 들어가고(WITHDRAW_ENABLED 없음), 운영 데이터 쓰기·삭제 없음
왕복: 2/3 · 막는 문제 이전 5건(Codex 1차) → 이 판에서 범위를 나눠 1단계에 해당하는 것만 반영

# 탈퇴 기능 1단계 계획

참조 규칙: 38절(기획 규칙 6단계), 55절(한계는 착수 전에 말하기), 63절(검수 왕복 3번), 65절(기획 3단계), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만).

## 0. 왜 두 단계로 나누나 (55절 정산)
| 항목 | 내용 |
|---|---|
| 지금까지 쓴 것 | 계획 v1~v4, 자체 반박 검토 3회(막는 문제 4 → 1 → 5건), Codex 검수 1회(막는 문제 5건). 약 1시간 40분(실측: 18:52~19:40) |
| 한계 | 법정 분리 보관·복구 불가 파기·DB 쓰기 장벽까지 한 번에 하면, 검토할 때마다 새 막는 문제가 나온다(v4 반박 검토 B1~B5). 왕복 3번 안에 끝나지 않을 가능성이 높다 |
| 결정 | 1단계: 핵심 탈퇴(로그인 차단·이름 가리기·내 데이터 삭제·진행 중 거래 막기)를 만들어 시험 서버와 "사람처럼 검수"에 쓴다. 운영에서는 꺼 둔다. 2단계: 운영에서 켜기 전에 v4 설계(법정 분리 보관·파기·쓰기 장벽·백업)와 v4 반박 검토 지적 B1~B5, S1~S7을 따로 계획해 검수받는다 |
| 1단계로 해결되는 Codex 1차 지적 | 4(카카오 재가입 충돌: 원격 끊기를 하지 않음), 3-2(제안 본문), 3-4(요청 제한 없음). 나머지 1·2·3·5·3-3은 2단계 범위로 넘긴다 |
| 재사용 | v4의 개인정보 전수표·법정 기간표·시험 목록은 2단계 계획의 바탕으로 그대로 쓴다 |

## 1. 1단계 완성 정의
- 시험 서버에서 사용자가 MY → 정산 계좌 화면 맨 아래 "탈퇴하기"로 탈퇴한다. 탈퇴하면 바로 로그아웃되고 다시 로그인할 수 없다.
- 상대방 화면과 채팅 알림에는 "탈퇴한 사용자"로 보인다.
- 진행 중인 거래가 있거나, 끝난 지 7일이 안 된 거래(분쟁을 열 수 있는 기간)가 있으면 탈퇴를 막는다.
- 거래 기록(주문·채팅·후기·분쟁)은 운영 DB에 그대로 둔다. 별도 보관과 파기는 2단계에서 한다.
- 운영 서버에서는 `WITHDRAW_ENABLED`가 없어서 버튼이 보이지 않고, API는 503을 돌려준다.

## 2. 정책
| # | 결정 |
|---|---|
| P1 | 막는 조건: 내가 구매자나 판매자인 주문 중 ① FINAL_STATUSES 밖 ② OPEN 분쟁 ③ 완료 뒤 7일 이내(app/src/lib/orders.ts:595의 분쟁 가능 기간과 같음). 먼저 advanceOrders를 돌리고, 트랜잭션 안에서 다시 확인한다 |
| P2 | 한 번만 실행: 트랜잭션 첫 줄에서 `status='ACTIVE'`일 때만 WITHDRAWN으로 바꾼다. 아니면 {already:true} |
| P3 | 이름 가리기: users.nickname="탈퇴한 사용자", kakao_image_url=null, show_photo=0, withdrawn_at=지금 |
| P4 | 바로 삭제: social_accounts, login_links, seller_accounts, wishlists, demand_intents, 내 notifications, push_subscriptions, notification_prefs |
| P5 | 상품: ACTIVE·HIDDEN → REMOVED. SOLD는 그대로. 글·사진은 2단계 전까지 그대로 둔다(사진 주소를 아는 사람은 열 수 있음 — 2단계 지적 S4) |
| P6 | 제안: 내가 낸 것과 내 상품에 걸린 남의 것 중 PENDING·ACCEPTED는 CANCELLED. 남의 제안에는 구매자에게 알림을 보낸다. 내가 쓴 message·seller_reply는 상태와 상관없이 비운다 |
| P7 | 상대 알림: 정확히 `<내 닉네임>님이 메시지를 보냈어요.`인 줄과, 정확히 `판매자가 제안을 거절했어요. "<내 답글>"`인 줄만 바꾼다 |
| P8 | 탈퇴자에게: 채팅 보내기 409, notifyTx는 ACTIVE가 아닌 사용자에게 알림 줄을 쓰지 않는다 |
| P9 | 통계 user_id: 무작위 가명 `wd_`+16바이트 hex로 바꾼다 |
| P10 | 재가입: 같은 카카오로 로그인하면 새 계정. 카카오 쪽 연결 끊기는 하지 않고 화면에서 안내만 한다. "탈퇴한사용자"(공백 제외)는 닉네임으로 쓸 수 없다 |
| P11 | 확인 문구 "탈퇴합니다"를 입력해야 실행한다 |

## 3. 파일
| 파일 | 상태 |
|---|---|
| app/drizzle/0018_withdraw.sql + meta(journal·snapshot) | 신규: users.withdrawn_at 칸 1개 |
| app/src/db/schema.ts | 수정 |
| app/src/lib/withdraw.ts | 신규: blockersOf, withdrawUser |
| app/src/app/api/me/withdraw/route.ts | 신규: GET 막는 거래, POST 탈퇴 |
| app/src/app/me/account/WithdrawForm.tsx, page.tsx | 신규·수정 |
| app/src/lib/notify.ts | 수정: ACTIVE 확인 |
| app/src/app/api/chats/[id]/route.ts | 수정: 상대 탈퇴 시 409 |
| app/src/lib/session.ts | 수정: 예약 닉네임 |
| ops/e2e/suites/test_withdraw.py | 신규: 시험 |

## 4. 설계–코드 대조표
| 설계 문장 | 호출 함수(파일:행) | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴하면 로그인 불가 | app/src/lib/session.ts:53 `getCurrentUserId`가 ACTIVE가 아니면 null | users | 없음 | 충돌 없음 |
| 탈퇴 시 쿠키 지움 | app/src/app/api/session/route.ts:58 `DELETE`와 같은 처리 | 없음 | 없음 | 충돌 없음 |
| 진행 중 거래 판정 | app/src/ui/trade-rules.ts:14 `FINAL_STATUSES`, app/src/lib/orders.ts:452 `advanceOrders` | orders, disputes | orders | 충돌 없음 |
| 7일 분쟁 기간 | app/src/lib/orders.ts:595와 같은 계산 | orders | 없음 | 충돌 없음 |
| 탈퇴 처리 | 신규 `withdrawUser`(lib/withdraw.ts, 동기 트랜잭션 하나, 비동기 없음) | users, orders, listings, trial_proposals | 2절 P2~P9의 표 | 충돌 없음 |
| 판매자 쪽 새 주문 막기 | app/src/lib/orders.ts:193 조건부 예약 update가 REMOVED 상품을 거절 | listings | listings | 충돌 없음 |
| 재가입 새 계정 | app/src/lib/kakao.ts:126 `userOfKakao` | social_accounts | users | 충돌 없음 |
| 이름 가리기 | app/src/lib/chat.ts:50, app/src/lib/reviews.ts:105가 users.nickname을 읽음 | users | users | 충돌 없음 |
| 탈퇴자에게 알림 안 씀 | app/src/lib/notify.ts:40 `notifyTx`(notifications에 쓰는 함수)에 ACTIVE 확인 추가 | users | notifications | 충돌 없음 |
| 예약 닉네임 | app/src/lib/session.ts:31 `cleanNickname` | 없음 | 없음 | 충돌 없음 |
| 탈퇴 화면 | app/src/app/me/account/page.tsx:15 `AccountPage` | users, orders | 없음 | 충돌 없음 |

## 5. 외부 서비스 근거표
| 항목 | 공식 문서 주소 | 확인한 문장 | 확인일 | 상태 |
|---|---|---|---|---|
| 개인정보 파기 원칙 | https://www.law.go.kr/법령/개인정보보호법/제21조 | 다른 법령에 따라 보존하여야 하는 경우에는 그러하지 아니하다 | 2026-10-26 | 확인 |
| 거래기록 보존 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 계약 또는 청약철회 등에 관한 기록: 5년 | 2026-10-26 | 확인 |
| 1단계를 운영에서 켜도 되는지 | 해당 없음 | 분리 보관(시행령 제6조 제2항 제3호)을 1단계는 하지 않는다 | 2026-10-26 | 미확인 — 개발 범위 제외. 그래서 운영에서는 끈다(2단계 뒤 켬) |

## 6. 값 출처표
| 값 | 출처구분 | 근거 |
|---|---|---|
| 분쟁 가능 기간 7일 | 실측 | app/src/lib/orders.ts:595 `7 * 24` 시간 |
| 확인 문구 "탈퇴합니다" | 사용자 지시 | "스스로 판단해서 적용" 위임 |
| 가명 16바이트 | 사용자 지시 | 같음 |

## 7. 시험
| 번호 | 시험 | 틀린 입력·실패 확인 |
|---|---|---|
| T1 | 탈퇴 → 쿠키를 다시 써도 비로그인, 상대 채팅·후기·채팅 알림에 원래 닉네임 0건 | 탈퇴 전 같은 확인이 원래 닉네임을 찾는 것(1건 이상)을 먼저 보여 준다 |
| T2 | 진행 중 거래 → 409 + 목록 | 완료 8일 지난 거래만 있으면 통과, 6일이면 막힘(경계) |
| T3 | 판매자 탈퇴 → ACTIVE 상품 REMOVED, SOLD 그대로, 남의 제안 CANCELLED + 알림 | - |
| T4 | P4의 8개 표에 탈퇴자 줄 0 | 탈퇴 전 각 표에 줄이 있었음을 먼저 센다 |
| T5 | 동시 탈퇴 요청 2개 → withdrawn_at 1번만 기록, 두 번째는 already | - |
| T6 | 상대가 탈퇴자에게 채팅 → 409, 탈퇴자 알림 줄 0 | - |
| T7 | 닉네임이 "구매자"인 사람 탈퇴 → 상대의 다른 알림 본문 그대로 | - |
| T8 | 같은 카카오로 재가입 → 새 계정(id 다름) | - |
| T9 | 확인 문구 틀림 400, 남의 id를 본문에 넣어도 무시, "탈퇴한 사용자" 닉네임 거절 | 모두 틀린 입력 |
| T10 | WITHDRAW_ENABLED 없음 → API 503, 버튼 없음 | - |
| T11 | 화면: PC 1280px, 모바일 375px 실제 브라우저, 스크린샷 | - |
| T12 | 회귀: 기존 e2e 3묶음, 단위 시험 전체 | - |

## 8. 실패·원복표
| 실패 | 처리 |
|---|---|
| 트랜잭션 오류 | 전부 롤백 |
| 막는 거래 | 409 + 목록 |
| 이미 탈퇴 | {already:true}, 쿠키 지움 |

## 9. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 유지 |
|---|---|---|---|
| 코드 되돌림 | 없음(withdrawn_at 칸은 남음) | 없음(카카오 쪽은 건드리지 않음) | 탈퇴자는 WITHDRAWN이라 옛 코드에서도 로그인 불가 |

## 10. 2단계로 넘기는 것 (운영에서 켜기 전 필수)
- v4 4절 개인정보 전수표 + v4 반박 검토 B3·B5·S2에서 찾은 추가 위치(주문 스냅숏 처리 방식, SYSTEM 메시지·알림·주문 기록 속 메모, 써보기 조건 메모)
- 법정 분리 보관(별도 DB·별도 키·키 교체)과 기간별 자동 파기, secure_delete·WAL 정리·백업 30일
- DB 쓰기 장벽(트리거). v4 반박 검토 B1(SOLD 상품 갱신 충돌)·B4(users UPDATE 경쟁)·S5(조건식) 포함
- 상품 사진 공개 주소 차단(S4)
