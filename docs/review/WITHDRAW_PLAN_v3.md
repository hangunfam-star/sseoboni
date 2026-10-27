프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261026-1919 · 작성 일시: 2026-10-26 19:19:26 KST
기준 지시: 2026-10-26 규칙 총괄 세션 전달 "탈퇴 기능은 써보니 세션에서 개발" + 정책 Q1~Q7 권장안에 사용자 "진행" + 사용자 "스스로 판단해서 적용" · 버전: v3(탈퇴 기능 개발 계획, 2차 반박 검토 14건 반영) (이전 v2) · 이전 버전과 같은지: 일부 다름
일의 크기: 대 — 운영 DB 표 구조 변경·개인정보 삭제·운영 반영 포함

# 탈퇴 기능 개발 계획 v3

참조 규칙: PLANNING_RULES_v3.md, 38절(기획 규칙 6단계), 41절(기획 규칙 v3 보강), 42절(계획서 관문), 53절(미룸 0건), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만).

## 0. 반박 검토 이력
| 회차 | 대상 | 막는 문제 | 고쳐야 할 문제 | 작은 문제 | 결과 |
|---|---|---|---|---|---|
| 1차 | v1 | 4 | 9 | 5 | v2에서 반영 |
| 2차(전체 재검토) | v2 | 1 | 4 | 9 | 이 v3에서 모두 반영. 표의 "(2-n)"이 2차 지적 번호 |

## 1. 완성 지도
- 완성 정의
  - 로그인한 사용자가 MY → 정산 계좌 화면(`/me/account`) 맨 아래 "탈퇴하기"로 탈퇴한다.
  - 탈퇴하면 바로 로그아웃되고, 다시 로그인할 수 없다.
  - 다른 사람 화면과 알림에는 "탈퇴한 사용자"만 보인다.
  - 거래·분쟁 기록은 법정 기간 동안 분리 보관한 뒤 자동으로 지운다.
- 현재 위치: 탈퇴 기능이 없다. 부분 기능 3개만 있다.
- 남은 개발 순서
  1. DB 이전
  2. 탈퇴 처리 함수
  3. 경쟁 막기(주문·제안·채팅 3곳)
  4. 채팅·알림 막기
  5. API
  6. 화면
  7. 지표 조정
  8. 자동 파기·재시도 작업
  9. 시험
  10. Codex 검수
  11. 운영 반영(승인)
- 필요한 승인
  - 운영 반영 1회: 83절(승인은 4가지만) ③
  - 카카오 어드민 키 등록: 83절 ④. 사용자가 직접 넣는다
- 되돌리기: 코드는 이전 커밋으로 되돌린다. DB에는 새 표와 칸만 추가한다. 실제 사용자가 탈퇴하며 지운 데이터는 되돌릴 수 없으므로, TEST에서 끝까지 확인한 뒤에만 운영에 반영한다.

## 2. 확정된 정책 (Q1~Q7은 사용자 "진행", 나머지는 사용자 "스스로 판단" 지시로 작성자가 정함)
| # | 정책 | 결정 |
|---|---|---|
| Q1 | 진행 중 거래 | 내가 구매자나 판매자인 주문 중 FINAL_STATUSES 밖의 것, 또는 그 주문에 걸린 OPEN 분쟁이 있으면 막는다. 판정 전에 `advanceOrders(내 주문 id)`를 돌리고, 트랜잭션 안에서 다시 확인한다. GET 화면 열기에서도 advanceOrders가 돌아 자동 확정·알림이 생길 수 있다. 이는 orderView와 같은 기존 동작이다(2-10) |
| Q1-2 | 상대가 응답하지 않음 | 막는 거래 목록 아래에 "/feedback으로 알려 주세요" 안내. 운영자 강제 탈퇴는 범위 밖 |
| Q1-3 | 두 번 동시 요청 | 트랜잭션 첫 줄에서 `status='ACTIVE'`인 경우에만 WITHDRAWN으로 바꾼다. 바뀐 줄이 1이 아니면 {already:true}로 끝낸다(2-2) |
| Q2 | 올린 상품 | ACTIVE·HIDDEN은 REMOVED로, SOLD는 그대로. 주문 없는 REMOVED 상품의 사진은 바로 파기 대상. 주문 있는 상품·SOLD 상품의 사진은 그 상품의 마지막 ORDER_PII가 파기될 때 함께 파기(2-5) |
| Q2-2 | 내 상품에 걸린 남의 제안 | PENDING·ACCEPTED → CANCELLED, 구매자에게 알림. 내가 쓴 seller_reply는 비움(2-13) |
| Q2-3 | 탈퇴 중 경쟁 | 주문 신청·제안·새 채팅방 3곳이 트랜잭션 안에서 구매자·상대 users.status='ACTIVE'와 listings.status='ACTIVE'를 다시 확인한다(2-3) |
| Q3 | 채팅 | 탈퇴일+3년 보관. 파기할 때 줄은 지우지 않고 내가 쓴 메시지 body만 "(탈퇴한 사용자의 메시지)"로 바꾼다. 순번·읽음 커서·신고 화면이 깨지지 않게 하려는 것(2-6). 상대방은 더 보낼 수 없다(409) |
| Q3-2 | 상대 알림의 내 닉네임 | url이 내 채팅방 `/chats/<id>`이고 본문이 정확히 `<내 닉네임>님이 메시지를 보냈어요.`인 줄만 `탈퇴한 사용자님이 메시지를 보냈어요.`로 통째로 바꾼다. 문자열 부분 치환은 하지 않는다(2-1) |
| Q4 | 정산 계좌·프로필 사진·찜·찾는 상품·내 알림·푸시·알림 설정·로그인 링크 | 바로 지운다 |
| Q5 | 재가입·예약 닉네임 | 같은 카카오로 로그인하면 새 계정. 공백을 모두 뺀 값이 "탈퇴한사용자"인 닉네임은 거절(2-12) |
| Q6 | 주문 속 개인정보 | 구매자가 탈퇴하면 배송지·환불 계좌·입금자명을, 판매자가 탈퇴하면 신청 시 판매자 계좌를 암호화해 retained_records(ORDER_PII)로 옮긴다. 상대 쪽 값은 건드리지 않는다(2-11). 주문 칸은 입금자명 "탈퇴한 사용자", 배송지 "", 계좌 null로 바꾼다. 거래 완료일(없으면 탈퇴일)+5년에 파기 |
| Q6-1 | 판매자 화면 배송지 문구 | 상대가 탈퇴했으면 "탈퇴한 사용자(기록 보관 중)"로 보인다(2-8) |
| Q6-2 | 거래 메모·운송장·분쟁 내용 | 남긴다. 주문 메모는 5년, 분쟁은 3년 뒤 파기 작업이 비운다 |
| Q6-3 | 후기 본문 | 남긴다(이름 익명화). 공개 후기다 |
| Q6-4 | 제안 한마디·제안 답글 | 바로 비운다(2-13) |
| Q6-5 | 의견 보내기(FEEDBACK) 본문 | 남긴다. 운영자에게 보낸 글이고, 무응답 신고가 지워지면 안 되기 때문이다(2-14). user_id는 가명으로 바꾼다 |
| Q7 | 카카오 쪽 연결 끊기 | 트랜잭션 안에서 withdrawals에 끊을 카카오 id와 결과 "PENDING"을 저장하고, 커밋 뒤 끊는다. 실패·서버 꺼짐 때는 정기 작업이 다시 시도한다(2-9). 키가 없으면 "SKIPPED_NO_KEY". 운영 서버에는 지금 키가 없다(2026-10-26 실측) |
| Q8 | 통계 사용자 id | 무작위 가명(`wd_`+무작위 16바이트 hex)을 만들어 withdrawals에 저장하고 user_id를 그 값으로 바꾼다. 비밀키는 쓰지 않는다(2-7) |
| Q8-2 | 줄어드는 지표(받아들임) | 찜 수(wishes)와 찾는 사람 수(seekers, 종류별 포함)가 준다. 탈퇴자의 데이터를 지운 결과이므로 받아들인다. 탈퇴 판매자의 REMOVED 상품은 listingStats·categoryStats·termsStats에서도 빠진다. 이것도 받아들이고, 관리자 화면에 "탈퇴로 내려간 상품 n개"를 따로 보인다(2-4) |
| Q8-3 | 남의 찜이 REMOVED 상품을 가리킴 | 찜 화면은 이미 ACTIVE만 보인다(app/src/app/wishlist/page.tsx:25-29). MY 찜 수와 관리자 찜 수도 REMOVED 상품을 빼도록 바꾼다(지적 16 확정) |
| Q9 | 긴급 정지 | `WITHDRAW_ENABLED=1`일 때만 켜짐 |
| Q10 | 탈퇴 판매자 채널 | 404(지금 동작). SOLD 상품 화면의 판매자 링크도 404로 이어진다. 그대로 둔다 |

## 3. 파일
| 파일 | 상태 | 역할 |
|---|---|---|
| app/drizzle/0018_withdraw.sql + meta/0018_snapshot.json·_journal.json | 신규·수정 | users.withdrawn_at, withdrawals(사용자 id·시각·가명·카카오 id·끊기 결과·재시도 수), retained_records(id·사용자 id·종류 ORDER_PII/ORDER_PHOTO/CHAT/FILE·주문/상품/방 id·파일 이름·암호문·파기 예정일). 0017과 같은 방식으로 만든다 |
| app/src/db/schema.ts | 수정 | 위 정의 |
| app/src/lib/withdraw.ts | 신규 | blockersOf, withdrawUser(동기 트랜잭션), afterWithdraw, purgeRetained, retryKakaoUnlinks |
| app/src/lib/kakao.ts | 수정 | unlinkKakaoRemote |
| app/src/lib/session.ts | 수정 | cleanNickname 예약어 |
| app/src/lib/notify.ts | 수정 | notifyTx는 ACTIVE 사용자에게만 |
| app/src/lib/orders.ts | 수정 | createOrder 트랜잭션 안에서 구매자 ACTIVE 확인(2-3) |
| app/src/app/api/proposals/route.ts | 수정 | 트랜잭션 안에서 상품·구매자 ACTIVE 확인(2-3) |
| app/src/app/api/chats/route.ts | 수정 | 방을 만들 때 트랜잭션 안에서 상품·양쪽 사용자 ACTIVE 확인(2-3) |
| app/src/app/api/chats/[id]/route.ts | 수정 | 상대가 WITHDRAWN이면 409 |
| app/src/app/orders/[id]/page.tsx | 수정 | 탈퇴 상대 표시 문구(2-8) |
| app/src/lib/admin-metrics.ts | 수정 | 찜 수에서 REMOVED 제외, 탈퇴 수·탈퇴로 내린 상품 수·카카오 끊기 실패 수 |
| app/src/app/me/page.tsx | 수정 | MY 찜 수에서 REMOVED 제외 |
| app/src/app/api/me/withdraw/route.ts | 신규 | GET 막는 거래, POST 탈퇴 |
| app/src/app/me/account/WithdrawForm.tsx, page.tsx | 신규·수정 | 화면 |
| app/src/lib/jobs.ts | 수정 | runJobs에 purgeRetained·retryKakaoUnlinks |
| ops/e2e/suites/test_withdraw.py | 신규 | 실제 브라우저 시험 |

## 4. 표별 처리
| 표.칸 | 처리 |
|---|---|
| users | status=WITHDRAWN(조건부), nickname="탈퇴한 사용자", kakao_image_url=null, show_photo=0, withdrawn_at |
| seller_profiles / buyer_profiles / xp_awards / reviews / trial_reviews / disputes.opener_id / order_events.actor_id | 남김 |
| listings.seller_id | ACTIVE·HIDDEN → REMOVED, SOLD는 그대로. 사진 파기는 Q2 |
| trial_proposals.buyer_id(내가 낸 것) | PENDING·ACCEPTED → CANCELLED, message 비움 |
| trial_proposals(내 상품에 걸린 남의 것) | PENDING·ACCEPTED → CANCELLED + 알림, seller_reply 비움 |
| chat_threads / chat_messages.sender_id | 남김. retained_records(CHAT, 탈퇴일+3년)에 방 id 기록. 파기 때 내 메시지 body만 바꿈 |
| orders.buyer_id·seller_id | 남김. Q6대로 내 쪽 값만 옮기고 바꿈 |
| order_photos.user_id | 남김. retained_records(ORDER_PHOTO, 거래 완료일+3년) |
| demand_intents / seller_accounts / social_accounts / login_links / notifications / push_subscriptions / notification_prefs / wishlists | 지움 |
| 상대 notifications.body | Q3-2의 정확히 일치하는 줄만 바꿈 |
| market_validation_events.user_id·metadata 안 id 2곳 | 가명으로 바꿈 |

## 5. 설계–코드 대조표
| 설계 문장 | 호출 함수(파일:행) | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴하면 바로 로그인 불가 | app/src/lib/session.ts:53 `getCurrentUserId`가 ACTIVE가 아니면 null | users | 없음 | 충돌 없음 |
| 탈퇴 시 쿠키 지움 | app/src/app/api/session/route.ts:58 `DELETE`와 같은 처리 | 없음 | 없음 | 충돌 없음 |
| 진행 중 거래 판정 | app/src/ui/trade-rules.ts:14 `FINAL_STATUSES`, 먼저 app/src/lib/orders.ts:452 `advanceOrders` | orders, disputes | orders | 충돌 없음 |
| 두 번 실행 막기 | 신규 `withdrawUser` 첫 줄 조건부 update(users.status='ACTIVE') | users | users | 충돌 없음 |
| 판매자 쪽 새 주문 막기 | app/src/lib/orders.ts:193 조건부 `status='ACTIVE'` 예약 update가 REMOVED 상품을 거절 | listings | listings | 충돌 없음 |
| 구매자 쪽 경쟁 막기 | app/src/lib/orders.ts:192 `createOrder` 트랜잭션 안에 구매자 ACTIVE 확인 추가 | users | orders | 충돌 없음 |
| 제안 경쟁 막기 | app/src/app/api/proposals/route.ts:29 트랜잭션 안에 상품·구매자 ACTIVE 확인 추가 | listings, users | trial_proposals | 충돌 없음 |
| 채팅방 경쟁 막기 | app/src/app/api/chats/route.ts:29 확인을 트랜잭션 안으로 옮기고 양쪽 사용자 ACTIVE 확인 추가 | listings, users | chat_threads | 충돌 없음 |
| 재가입은 새 계정 | app/src/lib/kakao.ts:126 `userOfKakao` | social_accounts | users | 충돌 없음 |
| 써보니 쪽 카카오 연결 지움 | app/src/lib/kakao.ts:152 `unlinkKakao`와 같은 삭제를 트랜잭션 안에서 | social_accounts | social_accounts, withdrawals | 충돌 없음 |
| 카카오 쪽 끊기는 커밋 뒤·재시도 | 신규 `unlinkKakaoRemote`, `retryKakaoUnlinks` | withdrawals | withdrawals | 충돌 후 해소: 동기 트랜잭션에는 비동기를 넣을 수 없어 커밋 뒤로 옮기고 대기 상태를 남김 |
| 사진 파일 삭제는 커밋 뒤 | app/src/lib/photos.ts:24 `photoPath`로 경로를 구해 직접 지움. 실패하면 retained_records(FILE)로 재시도 | retained_records | retained_records | 충돌 후 해소: app/src/lib/photos.ts:83 `deletePhoto`는 실패를 삼켜서 쓰지 않음 |
| 이름 익명화 | app/src/lib/chat.ts:50, app/src/lib/reviews.ts:105가 users.nickname을 읽음 | users | users | 충돌 없음 |
| 입금자명 익명화 | app/src/lib/orders.ts:199 호출, 정의는 app/src/ui/trade-rules.ts:245 `depositNameFor` | orders | orders, retained_records | 충돌 없음 |
| 상대 알림 줄 바꿈 | app/src/lib/notify.ts:40 `notifyTx`로 저장된 줄 중 채팅 API(app/src/app/api/chats/[id]/route.ts 57행) 형식과 정확히 같은 줄만 | notifications | notifications | 충돌 없음 |
| 탈퇴자에게 알림 안 감 | app/src/lib/notify.ts:40 `notifyTx`에 ACTIVE 확인 | users | 없음 | 충돌 없음 |
| 찜 수에서 REMOVED 제외 | app/src/lib/admin-metrics.ts:28, app/src/app/me/page.tsx:94 | wishlists, listings | 없음 | 충돌 없음 |
| 자동 파기 | app/src/lib/jobs.ts:85 `runJobs`에 신규 `purgeRetained` | retained_records | retained_records, order_photos, chat_messages, orders, disputes | 충돌 없음 |
| 예약 닉네임 | app/src/lib/session.ts:31 `cleanNickname` | 없음 | 없음 | 충돌 없음 |
| 탈퇴 화면 | app/src/app/me/account/page.tsx:15 `AccountPage` | users, orders | 없음 | 충돌 없음 |

## 6. 외부 서비스 근거표
| 항목 | 공식 문서 주소 | 확인한 문장 | 확인일 | 상태 |
|---|---|---|---|---|
| 거래기록 보존 기간 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 계약 또는 청약철회 등에 관한 기록: 5년 / 대금결제 및 재화등의 공급에 관한 기록: 5년 / 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 | 2026-10-26 | 확인 |
| 동의 철회 소비자 기록 분리 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 개인정보의 이용에 관한 동의를 철회한 소비자의 거래기록 및 개인정보를 보존하는 경우에는 … 별도로 보존할 것 | 2026-10-26 | 확인 |
| 개인정보 파기·분리 보관 | https://www.law.go.kr/법령/개인정보보호법/제21조 | 다른 법령에 따라 보존하여야 하는 경우에는 … 다른 개인정보와 분리하여서 저장ㆍ관리하여야 한다 | 2026-10-26 | 확인 |
| 카카오 연결 끊기 API | https://developers.kakao.com/docs/ko/kakaologin/rest-api | POST https://kapi.kakao.com/v1/user/unlink, Authorization: KakaoAK ${SERVICE_APP_ADMIN_KEY}, target_id_type=user_id, target_id | 2026-10-26 | 확인 |
| 써보니가 통신판매중개자에 해당하는지 | 해당 공식 해석 문서를 찾지 못함 | 판정 문장 없음 | 2026-10-26 | 미확인 — 개발 범위 제외. 보관 의무가 있다고 가정하고 5년·3년으로 정한다 |

## 7. 값 출처표
| 값 | 출처구분 | 근거 |
|---|---|---|
| 거래 개인정보·메모 보관 5년 | 공식 문서 | 시행령 제6조 제1항 제2·3호 |
| 분쟁 기록·증거 사진·채팅 보관 3년 | 공식 문서 | 같은 조 제1항 제4호(채팅은 분쟁 증거로 봄) |
| 카카오 끊기 시간 제한 10초 | 제안(승인 필요) | 사용자 "스스로 판단" 위임 |
| 확인 문구 "탈퇴합니다" | 제안(승인 필요) | 같음 |
| 1분에 3번 넘게 요청하면 429 | 제안(승인 필요) | 같음 |
| 가명 무작위 16바이트 | 제안(승인 필요) | 같음 |

## 8. 권한 범위
| 누가 | 할 수 있는 것 |
|---|---|
| 본인(로그인) | 자기 계정만 탈퇴. 요청 본문의 id는 받지 않음 |
| 다른 사용자 | 없음. 탈퇴자에게 채팅·제안·주문 불가 |
| 운영자 | 탈퇴 수·탈퇴로 내린 상품 수·카카오 끊기 실패 수만 봄. 강제 탈퇴 범위 밖 |

## 9. 실패·원복표
| 실패 | 처리 |
|---|---|
| 트랜잭션 중간 오류 | 전부 롤백, 오류 문구 |
| 커밋 뒤 파일 삭제 실패 | retained_records(FILE)로 다시 시도, withdrawals에 실패 수 |
| 카카오 끊기 실패·서버 꺼짐 | withdrawals에 PENDING 남김, 정기 작업이 재시도(최대 5번, 그 뒤 FAILED 표시) |
| 진행 중 거래 | 409 + 목록 + 무응답 안내 |
| 이미 탈퇴·동시 요청 | 조건부 update로 한 번만 실행, 나머지는 {already:true} |

## 10. 값 제한 점검
- 확인 문구가 정확히 일치해야 실행한다.
- 요청 본문의 id는 무시한다.
- 1분에 3번 넘게 요청하면 429.
- 공백을 뺀 "탈퇴한사용자" 닉네임은 거절한다.
- 카카오 재시도는 최대 5번.

## 11. 동작 특성과 시험 방법
- 운영 복사 DB와 가짜 카카오 서버에서 시험한다. 시험 전 스냅숏을 남기고 끝나면 원복해 차이 0을 확인한다(25절(기능 검수는 실제 실행)).
- 시험 사례
  1. 거래 없는 사용자 탈퇴 → 로그인 불가. 상대의 채팅·후기·알림 화면에 원래 닉네임 0건
  2. 진행 중 거래가 있으면 409
  3. 판매자 탈퇴 → ACTIVE 상품은 REMOVED, SOLD 상품은 그대로. 남의 제안은 CANCELLED이고 알림이 간다
  4. 구매자 탈퇴 → 입금자명·배송지가 바뀌고 ORDER_PII 1줄. 판매자 화면에 원래 값 0건과 "기록 보관 중" 표시
  5. 판매자 탈퇴 뒤 구매자의 끝난 주문 화면이 정상
  6. 재가입하면 새 계정
  7. 탈퇴자에게 채팅 → 409, 알림 줄 0
  8. 파기 작업에 기한 뒤 시각을 넣으면 종류별로 파기되고, 채팅 줄 수는 그대로 body만 바뀜
  9. 지표: 보는 사람 수는 같고, 찜 수·찾는 사람 수는 탈퇴자 몫만큼만 줄어듦(숫자로 대조)
  10. 동시 탈퇴 요청 2개 → withdrawals 1줄
  11. 탈퇴 직후 그 사람 이름으로 주문·제안·채팅방 만들기 → 모두 거절
  12. 닉네임이 "구매자"인 사람이 탈퇴 → 상대의 거래 알림 본문이 바뀌지 않음(2-1 실패 재현 방지)
  13. 일부러 틀린 입력: 확인 문구 틀림 400, 남의 id 무시, 예약 닉네임 거절
- 화면은 PC 1280px, 모바일 375px(UA·터치 흉내)로 본다. 보고는 84절(통과 보고에 입력 규모·확인한 것·실패 가능 증거) 기준이다.

## 12. 회귀
- test_checks.py, test_checks_fix.py, legacy/trade_e2e.py, 단위 시험 전체
- 로그아웃, 카카오 연결 해제, 정산 계좌 삭제, 주문 신청, 제안, 채팅 시작

## 13. 합격 기준
| 기준 | 판정 방법 |
|---|---|
| 탈퇴 후 로그인 불가 | 쿠키를 다시 써도 비로그인 |
| 다른 사람 화면·알림에 개인 정보 없음 | 상대 계정의 화면 글자에서 원래 닉네임·주소 0건 |
| 진행 중 거래·경쟁 규칙 | 사례 2·3·10·11 |
| 분리 보관·자동 파기 | 사례 4·8 |
| 남의 데이터 보호 | 사례 12 |
| 지표 | 사례 9 |
| 실제 브라우저 PC·모바일 | 스크린샷 경로 |
| 원복 | 스냅숏 비교 차이 0 |

## 14. 운영 요건·권한·막힘 대응표
| 항목 | 내용 |
|---|---|
| 필요 권한 | 운영 반영 1회 승인(83절 ③), 카카오 어드민 키(83절 ④) |
| 항상 사람이 할 일 | 키 등록, 운영에서 WITHDRAW_ENABLED=1 켜기 |
| 막힘 → 대처 | 카카오 실패 → PENDING으로 남기고 재시도 5번, 그 뒤 FAILED로 관리자 화면에 표시 |
| 긴급 정지 | WITHDRAW_ENABLED를 빼면 API 503, 버튼 숨김 |
| 막힘 재현 시험 | 가짜 카카오 unlink가 500을 돌려주게 하고 사례 1을 다시 돈다 |

## 15. 선행 시험·개선 경로·범위 동결
- 선행 시험: 개발 첫 단계에서 운영 복사 DB의 사용자 수, 진행 중 거래 수, 남의 제안 수를 읽기 전용으로 센다.
- 개선 경로: 탈퇴 사유는 받지 않는다.
- 범위 동결: 운영자 강제 탈퇴, 탈퇴 사유, 내 데이터 내려받기는 "발견 목록"에 둔다.
- 미룬 확인: 0건(지적 16은 2절 Q8-3에서 확정).

## 16. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 유지 |
|---|---|---|---|
| 코드 되돌림(이전 커밋) | 없음(새 표는 남음) | 이미 끊은 카카오 연결은 다시 붙지 않음 | 탈퇴자는 WITHDRAWN이라 옛 코드에서도 로그인 불가 |
| 새 표 삭제(하지 않음) | withdrawals·retained_records | 지운 개인정보 복구 불가 | 이 롤백은 하지 않는다 |

## 17. 예상 지적
- 통신판매중개자 해당 여부가 미확인이다. → 의무가 있다고 가정했다.
- 채팅 3년 보관 근거 → 분쟁 증거로 보았다. 기간을 줄이려면 사용자 결정이 필요하다.
- 보관 암호문 키 → 기존 crypto-box 키를 쓰고, 키를 바꿀 때 다시 암호화한다.
