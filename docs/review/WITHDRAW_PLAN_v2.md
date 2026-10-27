프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261026-1912 · 작성 일시: 2026-10-26 19:12:05 KST
기준 지시: 2026-10-26 규칙 총괄 세션 전달 "탈퇴 기능은 써보니 세션에서 개발" + 정책 Q1~Q7 권장안에 사용자 "진행" + 사용자 "스스로 판단해서 적용" · 버전: v2(탈퇴 기능 개발 계획, 자체 반박 검토 18건 반영) (이전 v1) · 이전 버전과 같은지: 일부 다름
일의 크기: 대 — 운영 DB 표 구조 변경·개인정보 삭제·운영 반영 포함

# 탈퇴 기능 개발 계획 v2

참조 규칙: PLANNING_RULES_v3.md, 38절(기획 규칙 6단계), 41절(기획 규칙 v3 보강), 42절(계획서 관문), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만).

## 0. v1에서 바뀐 점
자체 반박 검토(docs/review/SELF_REVIEW_WITHDRAW_PLAN_v2.md)에서 지적이 18건 나왔다.
- 막는 문제 4건: 1, 2, 3, 4
- 고쳐야 할 문제 9건: 5~13
- 작은 문제 5건: 14~18

모두 아래에 반영했다. 표에서 "(지적 n)"은 그 지적을 반영한 자리다.

## 1. 완성 지도
- 완성 정의
  - 로그인한 사용자가 MY → 정산 계좌 화면(`/me/account`) 맨 아래 "탈퇴하기"로 탈퇴한다.
  - 탈퇴하면 바로 로그아웃되고, 다시 로그인할 수 없다.
  - 다른 사람 화면과 알림에는 "탈퇴한 사용자"만 보인다.
  - 거래·분쟁 기록은 법정 기간 동안 분리 보관한 뒤 자동으로 지운다.
- 현재 위치: 탈퇴 기능 없음. 부분 기능 3개(로그아웃, 카카오 연결 해제, 정산 계좌 삭제)만 있다.
- 남은 개발 전체(순서)
  1. DB 이전
  2. 탈퇴 처리 함수
  3. 채팅·알림 막기
  4. API
  5. 화면
  6. 자동 파기 작업
  7. 시험
  8. Codex 검수
  9. 운영 반영(승인)
- 필요한 승인
  - 운영 반영 1회: 83절(승인은 4가지만) ③에 해당한다.
  - 카카오 어드민 키 등록: 83절 ④에 해당한다. 사용자가 직접 넣는다.
- 되돌리기: 코드는 이전 커밋으로 되돌린다. DB는 새 표·칸만 추가한다. 실제로 탈퇴한 사람의 지운 데이터는 되돌릴 수 없으므로 TEST에서 끝까지 확인한 뒤에만 운영에 반영한다.

## 2. 확정된 정책 (Q1~Q7은 사용자 "진행", 나머지는 사용자 "스스로 판단" 지시에 따라 작성자가 정함)
| # | 정책 | 결정 |
|---|---|---|
| Q1 | 진행 중 거래 | 내가 구매자나 판매자인 주문 중 FINAL_STATUSES 밖의 것, 또는 그 주문에 걸린 OPEN 분쟁이 있으면 막는다. 판정 전에 `advanceOrders(내 주문 id)`를 먼저 돌리고, 트랜잭션 안에서 한 번 더 확인한다(지적 4) |
| Q1-2 | 상대가 응답하지 않아 거래가 끝나지 않을 때 | 막는 거래 목록 아래에 "상대가 응답하지 않으면 의견 보내기로 알려 주세요(운영자가 확인해요)"와 /feedback 링크를 보인다. 운영자 강제 탈퇴는 이번 범위 밖이다(지적 11) |
| Q2 | 올린 상품 | ACTIVE·HIDDEN은 REMOVED로 바꾼다. SOLD는 그대로 둔다(지적 18). REMOVED가 된 상품 중 주문이 없는 것은 사진 파일도 지운다 |
| Q2-2 | 내 상품에 걸린 남의 써보기 제안 | PENDING·ACCEPTED를 CANCELLED로 바꾸고 제안한 구매자에게 "판매자가 탈퇴해 제안이 취소됐어요" 알림을 보낸다(지적 5) |
| Q3 | 채팅 | 탈퇴일로부터 3년간 남기고 자동 파기 작업이 지운다. 이름은 "탈퇴한 사용자"로 바꾼다. 상대방은 더 보낼 수 없다(409, 지적 6) |
| Q3-2 | 상대방 알림에 남은 내 닉네임 | 상대방 알림 본문에서 내 닉네임을 "탈퇴한 사용자"로 바꾼다(지적 3) |
| Q4 | 정산 계좌·프로필 사진·찜·찾는 상품·내 알림·푸시·알림 설정·로그인 링크 | 바로 지운다 |
| Q5 | 재가입 | social_accounts 연결을 지우므로 같은 카카오로 로그인하면 새 계정이 된다. "탈퇴한 사용자"는 닉네임으로 쓸 수 없게 막는다(지적 15) |
| Q6 | 주문 속 개인정보(배송지·환불 계좌·입금자명·신청 시 판매자 계좌) | 원래 값을 암호화해 `retained_records`로 옮긴다. 주문 칸은 입금자명 "탈퇴한 사용자", 배송지 "", 환불 계좌·판매자 계좌 null로 바꾼다(지적 2). 거래 완료일(completed_at, 없으면 탈퇴일)로부터 5년 뒤 파기한다(지적 9) |
| Q6-2 | 내가 쓴 거래 메모(반납 사유 메모·취소 사유·궁금한 점·받을 때·보낼 때 메모)·운송장·분쟁 내용 | 거래·분쟁 기록이므로 남긴다. 주문은 5년, 분쟁은 3년 뒤 파기 작업이 이 칸들을 비운다(지적 8) |
| Q6-3 | 후기·써보기 후기 본문 | 남긴다(이름은 익명화). 공개 후기라 보관 기간은 두지 않는다(지적 8) |
| Q6-4 | 제안 한마디(trial_proposals.message)·의견 보내기 본문(FEEDBACK metadata.message) | 바로 비운다(지적 8) |
| Q7 | 카카오 쪽 연결 끊기 | `KAKAO_ADMIN_KEY`가 있으면 트랜잭션 커밋 뒤 공식 API로 끊는다. 없으면 써보니 쪽 연결만 지우고 "SKIPPED_NO_KEY"를 기록한다. 운영 서버에는 지금 이 키가 없다(2026-10-26 서버 컨테이너 환경변수 이름 실측) |
| Q8 | 통계 기록의 사용자 id | null 대신 가명 `wd_`+HMAC(SESSION_SECRET, userId) 앞 24자로 바꾼다. 그래서 사람 수 지표가 줄지 않는다. JSON 안의 id(신고 metadata.reportedUserId, LOGIN_LINK_ISSUED metadata.userId)도 같은 가명으로 바꾼다(지적 7) |
| Q9 | 긴급 정지 | `WITHDRAW_ENABLED=1`일 때만 켜진다. 값이 없으면 꺼짐(지적 13) |
| Q10 | 탈퇴한 판매자 채널 | 지금처럼 404다(app/src/app/sellers/[id]/page.tsx:31). 의도한 동작으로 둔다(지적 14) |

## 3. 파일
| 파일 | 상태 | 역할 |
|---|---|---|
| app/drizzle/0018_withdraw.sql | 신규 | `users.withdrawn_at` 칸, `withdrawals` 표(사용자 id·시각·카카오 끊기 결과·파일 삭제 실패 수), `retained_records` 표(id·사용자 id·종류 ORDER_PII/ORDER_PHOTO/CHAT/FILE·주문 id·파일 이름·암호문·파기 예정일) |
| app/drizzle/meta/_journal.json | 수정 | 0018 등록(지적 17) |
| app/src/db/schema.ts | 수정 | 위 표·칸 정의 |
| app/src/lib/withdraw.ts | 신규 | `blockersOf`, `withdrawUser`(동기 트랜잭션), `afterWithdraw`(커밋 뒤 파일 삭제·카카오 끊기), `purgeRetained(now)`, `pseudoId` |
| app/src/lib/kakao.ts | 수정 | `unlinkKakaoRemote(kakaoId)` 추가(어드민 키 방식, 시간 제한 10초) |
| app/src/lib/session.ts | 수정 | `cleanNickname`이 "탈퇴한 사용자"를 막는다(지적 15) |
| app/src/lib/notify.ts | 수정 | `notifyTx`가 ACTIVE가 아닌 사용자에게는 알림을 만들지 않는다(지적 6) |
| app/src/app/api/chats/[id]/route.ts | 수정 | 상대가 WITHDRAWN이면 409 "탈퇴한 사용자와는 대화할 수 없어요"(지적 6) |
| app/src/app/api/me/withdraw/route.ts | 신규 | GET은 막는 거래 목록, POST는 탈퇴. 세션이 없으면 쿠키만 지우고 200 {already:true}(지적 10) |
| app/src/app/me/account/WithdrawForm.tsx | 신규 | 안내·막는 거래 목록·확인 입력 |
| app/src/app/me/account/page.tsx | 수정 | 맨 아래에 WithdrawForm을 붙인다(WITHDRAW_ENABLED가 아니면 숨김) |
| app/src/lib/jobs.ts | 수정 | `runJobs`에 `purgeRetained` 추가 |
| ops/e2e/suites/test_withdraw.py | 신규 | 실제 브라우저 시험 |

## 4. 표별 처리 (users.id 참조 칸 22개 + 참조 표시 없는 칸 3개 + JSON 안의 id 2곳)
| 표.칸 | 처리 |
|---|---|
| users | 남김. status=WITHDRAWN, nickname="탈퇴한 사용자", kakao_image_url=null, show_photo=0, withdrawn_at=지금 |
| seller_profiles / buyer_profiles | 남김(숫자만 있음) |
| listings.seller_id | 남김. ACTIVE·HIDDEN → REMOVED, SOLD는 그대로. 주문 없는 REMOVED 상품은 listing_photos 줄을 지우고 파일 이름을 retained_records(FILE)에 넣는다 |
| trial_proposals.buyer_id | 남김. 내가 낸 PENDING·ACCEPTED는 CANCELLED, message는 비움 |
| trial_proposals(내 상품에 걸린 남의 제안) | PENDING·ACCEPTED → CANCELLED + 구매자 알림 |
| chat_threads / chat_messages.sender_id | 남김. 내가 들어 있는 방 id를 retained_records(CHAT, 탈퇴일+3년)에 기록. 파기 때 그 방의 USER 메시지 중 내 것을 지운다 |
| demand_intents.user_id | 지움 |
| seller_accounts.user_id | 지움 |
| orders.buyer_id·seller_id | 남김. 내 쪽 개인정보(Q6)는 retained_records(ORDER_PII)로 옮기고 주문 칸을 바꾼다. 메모·운송장은 5년 뒤 비운다 |
| order_photos.user_id | 남김. 파일 이름을 retained_records(ORDER_PHOTO, 거래 완료일+3년)에 기록한 뒤 파기 때 줄과 파일을 지운다 |
| disputes.opener_id | 남김. detail은 3년 뒤 비운다 |
| reviews / trial_reviews | 남김(이름 익명화) |
| xp_awards.user_id | 남김 |
| social_accounts.user_id | 지움(+카카오 끊기, Q7) |
| login_links / notifications / push_subscriptions / notification_prefs | 지움 |
| 상대방 notifications.body | 내 닉네임이 들어간 본문의 닉네임을 "탈퇴한 사용자"로 바꾼다(대상: 나와 같은 채팅방·주문의 상대방) |
| wishlists.user_id(참조 표시 없음) | 지움 |
| market_validation_events.user_id(참조 표시 없음) | 가명으로 바꾼다. FEEDBACK의 metadata.message는 비운다 |
| market_validation_events.metadata 안의 reportedUserId·userId | 가명으로 바꾼다 |
| order_events.actor_id(참조 표시 없음) | 남김(거래 기록) |

## 5. 설계–코드 대조표
| 설계 문장 | 호출 함수(파일:행) | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴하면 바로 로그인 불가 | app/src/lib/session.ts:53 `getCurrentUserId`가 ACTIVE가 아니면 null | users | 없음 | 충돌 없음 |
| 탈퇴 시 쿠키 지움 | app/src/app/api/session/route.ts:58 `DELETE`와 같은 clearSessionCookie | 없음 | 없음 | 충돌 없음 |
| 진행 중 거래 판정 | app/src/ui/trade-rules.ts:14 `FINAL_STATUSES`, 먼저 app/src/lib/orders.ts:452 `advanceOrders(ids)` | orders, disputes | orders(자동 진행분) | 충돌 없음 |
| 판정과 처리 사이 새 주문 막기 | 신규 `withdrawUser` 트랜잭션 안에서 상품을 REMOVED로 먼저 바꾼다. app/src/lib/orders.ts:143이 REMOVED 상품 주문을 거절한다 | listings, orders | listings | 충돌 없음 |
| 재가입은 새 계정 | app/src/lib/kakao.ts:126 `userOfKakao`가 연결이 없으면 null을 돌려준다 → 가입 흐름 | social_accounts | users(새 줄) | 충돌 없음 |
| 써보니 쪽 카카오 연결 지움 | app/src/lib/kakao.ts:152 `unlinkKakao`와 같은 삭제를 트랜잭션 안에서 실행 | social_accounts | social_accounts | 충돌 없음 |
| 카카오 쪽 끊기는 커밋 뒤 | 신규 `unlinkKakaoRemote`(lib/kakao.ts), 신규 `afterWithdraw`에서 호출 | withdrawals | withdrawals | 충돌 후 해소: better-sqlite3 트랜잭션은 비동기를 넣을 수 없어 커밋 뒤로 뺐다(지적 1) |
| 사진 파일 삭제는 커밋 뒤 | app/src/lib/photos.ts:24 `photoPath`로 경로를 구해 신규 `afterWithdraw`에서 지운다. 실패하면 retained_records(FILE)에 남기고 `purgeRetained`가 다시 시도한다 | retained_records | retained_records | 충돌 후 해소: app/src/lib/photos.ts:83 `deletePhoto`는 비동기이고 실패를 삼켜 쓰지 않는다(지적 1) |
| 채팅·후기 이름 익명화 | app/src/lib/chat.ts:50, app/src/lib/reviews.ts:105가 users.nickname을 읽으므로 users 한 줄만 바꾸면 된다 | users | users | 충돌 없음 |
| 입금자명 익명화 | app/src/lib/orders.ts:199 `depositNameFor`가 닉네임으로 만든 값 → 주문 칸을 "탈퇴한 사용자"로 바꾼다 | orders | orders, retained_records | 충돌 없음 |
| 상대방 알림 닉네임 바꿈 | app/src/lib/notify.ts:40 `notifyTx`로 저장된 알림. 채팅 API(app/src/app/api/chats/[id]/route.ts 57행)가 본문에 닉네임을 넣는다 → 탈퇴 때 replace | notifications | notifications | 충돌 없음 |
| 탈퇴자에게 채팅·알림 안 감 | app/src/lib/notify.ts:40 `notifyTx`에 ACTIVE 확인 추가, 채팅 API(app/src/app/api/chats/[id]/route.ts 57행) 앞에 상대 상태 확인 추가 | users | 없음 | 충돌 없음 |
| 통계 사람 수 유지 | 신규 `pseudoId`. app/src/lib/admin-metrics.ts:25가 count(distinct user_id)로 세므로 null이 아닌 가명을 쓴다 | market_validation_events | market_validation_events | 충돌 없음 |
| 보관 기록 자동 파기 | app/src/lib/jobs.ts:85 `runJobs`에 신규 `purgeRetained` 추가 | retained_records | retained_records, order_photos, chat_messages, orders, disputes | 충돌 없음 |
| 탈퇴 화면 | app/src/app/me/account/page.tsx:15 `AccountPage`에 신규 WithdrawForm | users, orders | 없음 | 충돌 없음 |
| 예약 닉네임 | app/src/lib/session.ts:31 `cleanNickname`에 "탈퇴한 사용자" 거절 추가 | 없음 | 없음 | 충돌 없음 |

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
| 분쟁 기록·증거 사진·채팅 보관 3년 | 공식 문서 | 같은 조 제1항 제4호(채팅은 분쟁 증거로 보아 같은 기간) |
| 카카오 끊기 시간 제한 10초 | 제안(승인 필요) | 사용자가 "스스로 판단" 지시로 위임 |
| 확인 문구 "탈퇴합니다" | 제안(승인 필요) | 같음 |
| 1분에 3번 넘게 요청하면 429 | 제안(승인 필요) | 같음 |
| 가명 길이 24자 | 제안(승인 필요) | 같음 |

## 8. 권한 범위
| 누가 | 할 수 있는 것 |
|---|---|
| 본인(로그인) | 자기 계정만 탈퇴한다. 요청 본문의 id는 받지 않는다 |
| 다른 사용자 | 없음. 탈퇴자에게는 채팅을 보낼 수 없다 |
| 운영자 | 관리자 화면에 탈퇴 수와 카카오 끊기 실패 수가 보인다. 강제 탈퇴는 범위 밖 |

## 9. 실패·원복표
| 실패 | 처리 |
|---|---|
| 트랜잭션 중간 오류 | 전부 롤백한다. 탈퇴 안 됨, 오류 문구 표시 |
| 커밋 뒤 파일 삭제 실패 | retained_records(FILE)에 남기고 다음 파기 작업에서 다시 시도한다. withdrawals에 실패 수를 기록한다 |
| 카카오 끊기 실패·키 없음 | 탈퇴는 완료한다. 결과는 withdrawals에 기록한다 |
| 진행 중 거래 있음 | 409와 목록, 상대 무응답 안내 |
| 이미 탈퇴(세션 없음) | 쿠키를 지우고 200 {already:true} |

## 10. 값 제한 점검
- 확인 문구가 정확히 일치해야 실행한다.
- 요청 본문의 id는 무시한다.
- 1분에 3번 넘게 요청하면 429를 돌려준다.
- "탈퇴한 사용자"는 닉네임으로 쓸 수 없다.

## 11. 동작 특성과 시험 방법
- 운영 복사 DB와 가짜 카카오 서버에서 시험한다. 시험 전 스냅숏을 남기고, 끝나면 원복해 차이 0을 확인한다(25절(기능 검수는 실제 실행)).
- 사례
  1. 거래 없는 사용자 탈퇴 → 로그인 불가. 상대의 채팅·후기·알림 화면에 원래 닉네임 0건(실제 브라우저)
  2. 진행 중 거래 → 409와 목록
  3. 판매자 탈퇴 → ACTIVE 상품은 REMOVED, SOLD 상품은 그대로. 사진 파일 삭제. 남의 제안은 CANCELLED이고 구매자에게 알림
  4. 끝난 거래가 있는 구매자 탈퇴 → 주문의 입금자명 "탈퇴한 사용자", 배송지 빔. retained_records에 ORDER_PII 1줄. 판매자 주문 화면에서 원래 닉네임·주소 0건
  5. 판매자 탈퇴 뒤 구매자의 끝난 주문 화면이 깨지지 않음(지적 12)
  6. 같은 카카오로 다시 로그인 → 새 계정
  7. 상대가 탈퇴자에게 채팅 보내기 → 409, 탈퇴자 알림 줄 0
  8. 파기 작업에 시각을 기한 뒤로 넣으면 각 종류가 지워짐
  9. 관리자 지표의 보는 사람 수가 탈퇴 전후 같음
  10. 일부러 틀린 입력: 확인 문구 틀림 → 400, 남의 id 넣음 → 무시, "탈퇴한 사용자" 닉네임 → 거절
- 화면은 PC 1280px, 모바일 375px(UA·터치 흉내)로 본다. 보고는 84절(통과 보고에 입력 규모·확인한 것·실패 가능 증거) 기준으로 한다.

## 12. 회귀
- test_checks.py, test_checks_fix.py, legacy/trade_e2e.py와 단위 시험 전체를 돌린다.
- 로그아웃·카카오 연결 해제·정산 계좌 삭제가 그대로 동작하는지 확인한다.

## 13. 합격 기준
| 기준 | 판정 방법 |
|---|---|
| 탈퇴 후 로그인 불가 | 쿠키를 다시 써도 /api/session이 비로그인 |
| 다른 사람 화면·알림에 개인 정보 없음 | 상대 계정의 채팅·후기·주문·알림 화면 글자에서 원래 닉네임·주소 0건 |
| 진행 중 거래 규칙 | 사례 2·3 |
| 분리 보관·자동 파기 | 사례 4·8 |
| 지표 유지 | 사례 9 |
| 실제 브라우저 PC·모바일 | 스크린샷 경로 |
| 시험 데이터 원복 | 스냅숏 비교 차이 0 |

## 14. 운영 요건·권한·막힘 대응표
| 항목 | 내용 |
|---|---|
| 필요 권한 | 운영 반영 1회 승인(83절 ③), 카카오 어드민 키(83절 ④, 사용자가 직접 넣음) |
| 항상 사람이 할 일 | 키 등록, 운영에서 WITHDRAW_ENABLED=1 켜기 |
| 막힘 → 대처 | 카카오 API 실패 → 탈퇴는 진행하고 기록. 관리자 화면에 실패 수 표시 |
| 긴급 정지 | WITHDRAW_ENABLED를 빼면 API는 503, 버튼은 숨김 |
| 막힘 재현 시험 | 가짜 카카오 서버가 unlink에 500을 돌려주게 하고 사례 1을 다시 돈다 |

## 15. 선행 시험·개선 경로·범위 동결
- 선행 시험: 개발 첫 단계에서 운영 복사 DB의 사용자 수, 진행 중 거래 수, 남의 제안 수를 읽기 전용으로 센다.
- 개선 경로: 탈퇴 사유는 받지 않는다.
- 범위 동결: 운영자 강제 탈퇴, 탈퇴 사유 조사, 내 데이터 내려받기는 "발견 목록"에 둔다.
- 개발하면서 확인할 목록: 찜 목록·관리자 찜 수가 REMOVED 상품을 빼는지(지적 16, app/src/lib/admin-metrics.ts:28)

## 16. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 유지 |
|---|---|---|---|
| 코드 되돌림(이전 커밋) | 없음(새 표는 남음) | 이미 끊은 카카오 연결은 다시 붙지 않음 | 탈퇴 사용자는 WITHDRAWN이라 옛 코드에서도 로그인 불가 |
| 새 표 삭제(하지 않음) | withdrawals·retained_records 내용 | 지운 개인정보는 복구 불가 | 이 롤백은 하지 않는다 |

## 17. 예상 지적
- 통신판매중개자 해당 여부가 미확인이다. → 의무가 있다고 가정했다.
- 채팅을 3년 보관하는 근거가 약하다. → 분쟁 증거로 보아 3년으로 정했다. 짧게 하려면 사용자 결정이 필요하다.
- 보관 암호문의 키는? → 기존 crypto-box 키를 쓴다. 키를 교체할 때는 retained_records도 다시 암호화한다.
