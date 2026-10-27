프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261026-1932 · 작성 일시: 2026-10-26 19:32:30 KST
기준 지시: 2026-10-26 사용자 "탈퇴 기능 개발" + "스스로 판단해서 적용", Codex 1차 검수 FAIL(REQ-써보니-20261026-1922) · 버전: v4(탈퇴 기능 개발 계획, Codex 1차 지적 5건 반영) (이전 v3) · 이전 버전과 같은지: 일부 다름
일의 크기: 대 — 운영 DB 표 구조 변경·개인정보 삭제·운영 반영 포함
왕복: 2/3 · 막는 문제 이전 5건 → 이 판에서 5건 모두 반영

# 탈퇴 기능 개발 계획 v4

참조 규칙: PLANNING_RULES_v3.md, 38절(기획 규칙 6단계), 41절(기획 규칙 v3 보강), 42절(계획서 관문), 53절(미룸 0건), 63절(검수 왕복 3번), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만).

## 0. 이번 판에서 줄인 범위와 Codex 지적 처리표
범위를 줄였다.
- 카카오 쪽 연결 끊기는 이번 범위에서 뺐다. 운영 서버에 어드민 키가 없고, 로그인 토큰도 저장하지 않기 때문이다.
- 탈퇴 요청 횟수 제한도 뺐다. 확인 문구와 "한 번만 실행" 장치로 충분하다.

| 지적 유형 | 찾은 곳 | 고친 곳 | 남은 곳 |
|---|---|---|---|
| 1 개인정보 위치 누락 | Codex가 9가지(상품 글·JSON 키·사진 이름·이벤트·후기·알림 복사본·프로필·탈퇴 기록·의견 본문). 같은 유형을 직접 전수 조사해 추가로 1가지(상품 공유 이벤트·관심 이벤트의 metadata) | 4절을 모든 표·JSON 키·파일 단위 4분류 표로 다시 썼다 | 0 |
| 2 법정 보관 범위·분리·복구 불가 파기 | 6개월 기록 누락, 채팅 전체를 3년 분쟁 기록으로 간주, 같은 DB 안 보관, WAL·백업·파일 파기 | 5절: 기록 종류별 기간표, 별도 DB 파일·별도 키, secure_delete·WAL 정리·백업 30일 보관 | 0 |
| 3 탈퇴 중 다른 쓰기 | Codex 5곳. 같은 유형 전수: 쓰기 API 33개 중 사용자 소유 데이터를 쓰는 25개 | 6절: API마다 고치지 않고 DB 트리거(쓰기 직전 DB가 스스로 검사하는 장치)로 한 번에 막는다. 대상 표 전체 목록 | 0 |
| 4 카카오 재가입 충돌 | 커밋 뒤 재시도가 새 계정 연결을 끊는 순서 | 원격 끊기를 범위에서 빼서 충돌 자체를 없앴다. 써보니 쪽 연결만 지운다 | 0 |
| 5 시험 부족 | Codex 11가지 | 12절: 합격 기준마다 시험 번호를 연결하고, 오류 주입·경계 시각·경쟁 시험을 넣었다 | 0 |
| 3-1~3-5 고쳐야 할 문제 | 대조표 쓰기 대상, 제안 본문 범위, 키 교체, 요청 제한, git 상태 | 8절 대조표, 4절, 5절, 0절(제한 삭제), 14절 보호 목록 | 0 |
| 작은 문제: 요청서 번호 형식 | Codex는 "REQ-<프로젝트 2자리>"를 기준으로 보았다 | 현행 52절(구분 번호와 매칭)은 2026-10-23 개정 이후 "REQ-<프로젝트명>"이다. 그대로 둔다 | 0 |

## 1. 완성 지도
- 완성 정의
  - 사용자가 MY → 정산 계좌 화면 맨 아래에서 탈퇴한다.
  - 탈퇴하면 바로 로그아웃된다. 그 뒤에는 로그인할 수 없고, 그 사람 이름으로 새 데이터도 생기지 않는다.
  - 다른 사람 화면과 알림에는 "탈퇴한 사용자"만 보인다.
  - 법정 기록은 별도 파일에 암호화해 보관하고, 기한이 되면 복구할 수 없게 지운다.
- 개발 순서
  1. DB 이전(트리거·칸)
  2. 보관 DB와 키
  3. 탈퇴 처리
  4. 파기 작업
  5. API·화면
  6. 지표·알림 조정
  7. 시험
  8. Codex 코드 검수
  9. 운영 반영(승인)
- 필요한 승인(83절(승인은 4가지만))
  - 운영 반영 1회(③)
  - 운영 서버 새 비밀값 `RETAIN_SECRET` 등록(④)
  - 운영 서버의 30일 넘은 DB 백업 파일 삭제(②). 지금 /opt/sseoboni/backups에 10/10~10/16 백업 10개가 있다(2026-10-26 서버에서 읽기 전용으로 확인)
- 되돌리기: 코드는 이전 커밋으로 되돌린다. 트리거는 0018을 거꾸로 실행하는 스크립트로 지운다. 실제로 탈퇴하며 지운 데이터는 되돌릴 수 없으므로 TEST에서 끝까지 확인한다.

## 2. 확정된 정책
| # | 정책 | 결정 |
|---|---|---|
| Q1 | 진행 중 거래 | 내가 구매자·판매자인 주문 중 FINAL_STATUSES 밖의 것, 또는 그 주문의 OPEN 분쟁이 있으면 막는다. 먼저 advanceOrders를 돌리고, 트랜잭션 안에서 다시 확인한다 |
| Q1-2 | 상대 무응답 | 막는 거래 목록 아래에 /feedback 안내 |
| Q1-3 | 한 번만 실행 | 트랜잭션 첫 줄에서 `status='ACTIVE'`인 경우에만 WITHDRAWN으로 바꾼다. 바뀐 줄이 1이 아니면 {already:true} |
| Q2 | 올린 상품 | ACTIVE·HIDDEN → REMOVED, SOLD는 그대로. 상품 글·사진은 표시·광고 기록으로 6개월 보관 후 파기(5절) |
| Q3 | 채팅 | 탈퇴자가 쓴 메시지 중 주문이 있었던 상대와의 방은 계약 기록으로 5년, 그 주문에 분쟁이 있었으면 분쟁 기록 3년과 5년 중 긴 쪽으로 보관한다. 주문이 없었던 방의 내 메시지는 탈퇴 즉시 본문을 "(탈퇴한 사용자의 메시지)"로 바꾼다. 보관분도 별도 DB로 옮기고, 원래 줄의 본문은 즉시 바꾼다 |
| Q4 | 즉시 삭제 | 정산 계좌·프로필 사진 주소·찜·찾는 상품·내 알림·푸시·알림 설정·로그인 링크·카카오 연결(써보니 쪽) |
| Q5 | 재가입 | 같은 카카오로 로그인하면 새 계정이 된다. 원격 끊기를 하지 않으므로 충돌이 없다. "탈퇴한사용자"(공백 제외) 닉네임은 쓸 수 없다 |
| Q6 | 카카오 쪽 연결 끊기 | 이번 범위 밖. 탈퇴 화면에 "카카오 계정의 써보니 연결은 카카오 설정에서 직접 끊을 수 있어요"라고 안내한다. 어드민 키가 생기면 별도 계획으로 한다 |
| Q7 | 통계 사용자 id | 무작위 가명(`wd_`+16바이트 hex)으로 바꾼다. 가명은 원래 id와 연결해 저장하지 않는다(한 번 만들어 그 자리에서만 씀) |
| Q8 | 줄어드는 지표 | 찜·찾는 사람 수는 줄어든다(받아들임). 관리자 화면에 "탈퇴 n명", "탈퇴로 내린 상품 n개"를 보인다 |
| Q9 | 긴급 정지 | `WITHDRAW_ENABLED=1`일 때만 켜진다 |
| Q10 | 탈퇴 판매자 채널 | 404(지금 동작) |

## 3. 파일
| 파일 | 상태 | 역할 |
|---|---|---|
| app/drizzle/0018_withdraw.sql + meta/0018_snapshot.json·_journal.json | 신규·수정 | users.withdrawn_at, withdrawals(사용자 id·시각·파기 완료 시각), 쓰기 막는 트리거 전체(6절) |
| app/drizzle/rollback/0018_down.sql | 신규 | 트리거·표 제거(되돌리기) |
| app/src/db/schema.ts | 수정 | 위 정의 |
| app/src/lib/retain.ts | 신규 | 보관 DB `runtime-data/retained.db` 열기(secure_delete=ON, 별도 키 RETAIN_SECRET, 키 버전), 넣기·만료 파기·키 교체 |
| app/src/lib/withdraw.ts | 신규 | blockersOf, withdrawUser, afterWithdraw(파일 삭제), purgeExpired |
| app/src/lib/session.ts | 수정 | cleanNickname 예약어 |
| app/src/lib/notify.ts | 수정 | notifyTx는 ACTIVE 사용자에게만 알림 줄을 쓴다 |
| app/src/lib/admin-metrics.ts | 수정 | 찜 수에서 REMOVED 제외, 탈퇴 수, 탈퇴로 내린 상품 수 |
| app/src/app/me/page.tsx | 수정 | MY 찜 수에서 REMOVED 제외 |
| app/src/app/orders/[id]/page.tsx | 수정 | 탈퇴한 상대 표시 문구 |
| app/src/app/api/me/withdraw/route.ts | 신규 | GET 막는 거래, POST 탈퇴(503 when disabled) |
| app/src/app/me/account/WithdrawForm.tsx, page.tsx | 신규·수정 | 화면 |
| app/src/lib/jobs.ts | 수정 | runJobs에 purgeExpired |
| ops/backup_prune.sh | 신규 | 운영 서버 백업 30일 보관(운영 반영 때 승인 후 실행) |
| ops/e2e/suites/test_withdraw.py | 신규 | 시험 |

## 4. 개인정보 위치 전수표 (4분류: 즉시 삭제 / 법정 분리 보관 / 익명화 후 유지 / 보존 근거 없음 → 즉시 삭제)
| 위치 | 분류 | 처리 |
|---|---|---|
| users.nickname·kakao_image_url·show_photo | 익명화 후 유지 | "탈퇴한 사용자"·null·0. 행은 다른 표의 연결 기준이라 남긴다 |
| users.withdrawn_at, withdrawals | 법정 분리 보관 | 마지막 보관분 파기 때 withdrawals 줄도 지운다 |
| social_accounts, login_links, seller_accounts, wishlists, demand_intents, notifications(내 것), push_subscriptions, notification_prefs | 즉시 삭제 | 트랜잭션 안에서 삭제 |
| seller_profiles, buyer_profiles, xp_awards | 익명화 후 유지 | 숫자만 있다. users 익명화로 사람을 알 수 없다 |
| listings.title·description·check_items(탈퇴자 상품) | 법정 분리 보관 6개월(표시·광고) | 원래 값을 보관 DB로 옮기고, 원래 칸은 "탈퇴한 판매자의 상품"·""·null로 바꾼다. SOLD 상품도 같다(구매 기록 화면은 orders.snapshot을 쓴다) |
| listing_photos 줄·파일 | 법정 분리 보관 6개월 | 파일을 보관 폴더(runtime-data/retained/)로 옮기고 줄을 지운다. 6개월 뒤 파일 삭제 |
| listing_components | 익명화 후 유지 | 구성품 이름만 있다(개인정보 아님) |
| orders.snapshot(JSON: 제목·설명·구성품·조건·photo) | 법정 분리 보관 5년(계약) | 보관 DB로 옮기고, 원래 칸은 제목만 남긴 최소 스냅숏으로 바꾼다 |
| orders.deposit_name·ship_enc·refund_enc | 법정 분리 보관 5년(결제·공급) | 구매자가 탈퇴할 때 옮기고 "탈퇴한 사용자"·""·null |
| orders.seller_account_enc | 법정 분리 보관 5년 | 판매자가 탈퇴할 때만 옮기고 null |
| orders.questions·return_note·cancel_reason | 법정 분리 보관 5년(계약·청약철회) | 쓴 사람이 탈퇴하면 옮기고 원래 칸은 null |
| orders.arrival_check·pack_check(JSON: 구성품·메모·사진 이름) | 법정 분리 보관 5년(공급) | 구매자가 탈퇴하면 JSON 전체를 옮기고, 원래 칸에는 구성품 결과만 남긴다(메모·사진 이름 제거) |
| orders.inspection(JSON) | 법정 분리 보관 5년 | 판매자가 탈퇴하면 같은 방식 |
| orders.ship_tracking·return_tracking | 법정 분리 보관 5년(공급) | 쓴 쪽이 탈퇴하면 옮기고 null |
| order_photos 줄·파일 | 법정 분리 보관 5년(공급), 분쟁에 쓰였으면 max(5년, 3년) | 파일을 보관 폴더로 옮기고 줄을 지운다 |
| order_events.actor_id·data | 익명화 후 유지 | actor_id는 users 익명화로 사람을 알 수 없다. data에 개인정보가 없는지 개발 첫날 전수 조사하지 않고 지금 확인했다: data는 상태·금액·운송장 번호를 담는다. 운송장 번호가 있으면 위와 같이 옮기고 지운다 |
| disputes.detail·resolution | 법정 분리 보관 3년(분쟁) | 개설자가 탈퇴하면 detail을 옮기고 null. resolution은 운영자 글이라 그대로 둔다 |
| reviews.body, trial_reviews.answers·reason·learned·fit_for | 익명화 후 유지 | 다른 사용자를 위한 공개 후기다. 쓴 사람은 익명화된다. 본문에 연락처가 있는지 탈퇴 때 findContactInfo로 검사해 걸리면 본문을 비운다 |
| trial_proposals.message·seller_reply(상태 무관) | 즉시 삭제 | 탈퇴자가 쓴 것은 상태와 상관없이 비운다 |
| 상대 notifications 본문 복사본 | 즉시 삭제(정확히 일치하는 줄만) | ① `<닉네임>님이 메시지를 보냈어요.` → `탈퇴한 사용자님이 메시지를 보냈어요.` ② `판매자가 제안을 거절했어요. "<답글>"` → `판매자가 제안을 거절했어요.` ③ 제목의 상품명은 개인정보로 보지 않는다 |
| chat_messages.body(탈퇴자 작성) | Q3대로 | 보관분은 보관 DB로 옮기고, 원래 줄은 즉시 본문을 바꾼다 |
| market_validation_events.user_id | 익명화 후 유지 | 가명 |
| market_validation_events.metadata: FEEDBACK.message | 보존 근거 없음 → 30일 뒤 삭제 | 운영자가 볼 시간을 30일로 정하고 그 뒤 비운다 |
| metadata: CHAT_REPORT.reportedUserId·threadId·messageId | 익명화 후 유지 | reportedUserId만 가명으로 바꾼다. 방·메시지 id는 이미 익명화된 기록을 가리킨다 |
| metadata: LOGIN_LINK_ISSUED.userId | 익명화 후 유지 | 가명 |
| 그 밖의 이벤트 metadata(제안·공유·관심) | 익명화 후 유지 | 금액·기간·상품 id만 있다(listings/[id]/share, intents 라우트 확인) |
| 프로필 사진 파일 | 즉시 삭제 | 카카오 주소만 저장하므로 파일은 없다(kakao.ts 확인) |
| 운영 DB 백업 파일 | 보존 근거 없음 → 30일 | ops/backup_prune.sh로 30일 넘은 백업을 삭제한다(승인 대상) |

## 5. 법정 보관 기간표와 분리·파기 방식
| 기록 종류(시행령 제6조 제1항) | 기간 | 시작 기준 | 해당 칸 |
|---|---|---|---|
| 1호 표시·광고 | 6개월 | 탈퇴일 | 상품 글·사진 |
| 2호 계약·청약철회 | 5년 | 거래 완료일(없으면 탈퇴일) | snapshot·questions·return_note·cancel_reason·주문 있는 방의 채팅 |
| 3호 대금결제·재화 공급 | 5년 | 같음 | deposit_name·ship_enc·refund_enc·seller_account_enc·운송장·확인 JSON·거래 사진 |
| 4호 불만·분쟁 처리 | 3년 | 분쟁 정리일 | disputes.detail(같은 자료가 5년 대상이면 긴 쪽) |
- 분리 저장
  - 보관 자료는 운영 DB가 아닌 `runtime-data/retained.db`와 `runtime-data/retained/` 폴더에 둔다.
  - 암호화 키는 `RETAIN_SECRET`(세션 키와 다른 값)이다. 암호문마다 키 버전을 적는다.
  - 화면·관리자 CSV·API 어디에서도 읽지 않는다. 읽는 함수는 파기·키 교체 함수뿐이다.
- 복구 불가 파기
  - 두 DB 모두 `secure_delete=ON`(지운 자리를 0으로 덮어씀)으로 연다.
  - 파기 작업 끝에 `wal_checkpoint(TRUNCATE)`를 실행한다.
  - retained.db는 주 1회 VACUUM한다.
  - 파일은 unlink하고 결과를 확인한다. 실패하면 보관 DB에 남겨 다음 작업에서 다시 지운다.
  - 백업은 30일 보관이다.
- 키 교체: `rotateRetainKey(old,new)`가 한 줄씩 새 키로 다시 암호화하고 키 버전을 올린다. 중간에 실패해도 줄마다 키 버전이 있어 섞여도 읽힌다.

## 6. 쓰기 장벽 (DB 트리거)
- 방식: 0018에서 아래 표마다 `BEFORE INSERT`(필요하면 `BEFORE UPDATE`) 트리거를 만든다.
  - 그 줄의 사용자 칸이 가리키는 users.status가 'ACTIVE'가 아니면 `RAISE(ABORT, 'USER_INACTIVE')`로 쓰기를 거절한다.
  - 같은 DB 연결의 트랜잭션 안에서 검사하므로 경쟁이 생기지 않는다.
- 대상
  - 사용자 칸 기준: wishlists.user_id, demand_intents.user_id, seller_accounts.user_id, push_subscriptions.user_id, notification_prefs.user_id, notifications.user_id, login_links.user_id, social_accounts.user_id, chat_messages.sender_id(USER 종류만), chat_threads.buyer_id·seller_id, trial_proposals.buyer_id, orders.buyer_id·seller_id, order_photos.user_id, disputes.opener_id, reviews.writer_id, trial_reviews.writer_id, xp_awards.user_id, market_validation_events.user_id(가명 'wd_'는 통과)
  - 상품 기준: listings INSERT(seller_id), listings UPDATE(seller가 WITHDRAWN이고 새 status가 REMOVED가 아니면 거절. 탈퇴 처리와 파기의 칸 비우기는 status를 REMOVED로 유지하므로 통과), listing_photos INSERT(상품의 seller 기준)
- 쓰기 API 33개 중 이 표들을 쓰는 25개는 코드를 고치지 않아도 막힌다.
  - 정상 경로에서 탈퇴자는 getCurrentUserId 단계에서 이미 401이다. 트리거는 그 검사를 지난 직후 탈퇴가 커밋되는 경쟁 경우만 막는다.
  - 그 경우 응답은 각 API의 일반 오류(500)가 되고, DB 변경은 0이다. 응답 코드를 409로 바꾸는 일은 범위 밖으로 두고 발견 목록에 적는다.

## 7. 외부 서비스 근거표
| 항목 | 공식 문서 주소 | 확인한 문장 | 확인일 | 상태 |
|---|---|---|---|---|
| 거래기록 보존 기간 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 1. 표시ㆍ광고에 관한 기록: 6개월 2. 계약 또는 청약철회 등에 관한 기록: 5년 3. 대금결제 및 재화등의 공급에 관한 기록: 5년 4. 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 | 2026-10-26 | 확인 |
| 동의 철회 소비자 기록 분리 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 개인정보의 이용에 관한 동의를 철회한 소비자의 거래기록 및 개인정보를 보존하는 경우에는 … 별도로 보존할 것 | 2026-10-26 | 확인 |
| 개인정보 파기·분리 보관 | https://www.law.go.kr/법령/개인정보보호법/제21조 | 파기할 때에는 복구 또는 재생되지 아니하도록 조치하여야 한다 / 다른 개인정보와 분리하여서 저장ㆍ관리하여야 한다 | 2026-10-26 | 확인 |
| SQLite secure_delete | https://www.sqlite.org/pragma.html | When secure_delete is on, SQLite overwrites deleted content with zeros … should enable the secure_delete pragma prior to performing the delete or update, or else run VACUUM after the delete or update. (FTS 가상 표는 예외 — 써보니는 FTS를 쓰지 않음) | 2026-10-26 | 확인 |
| SQLite WAL 비우기 | https://www.sqlite.org/pragma.html | TRUNCATE: works the same way as RESTART with the addition that the WAL file is truncated to zero bytes upon successful completion | 2026-10-26 | 확인 |
| 카카오 연결 끊기 API | https://developers.kakao.com/docs/ko/kakaologin/rest-api | POST https://kapi.kakao.com/v1/user/unlink, Authorization: KakaoAK ${SERVICE_APP_ADMIN_KEY} | 2026-10-26 | 확인(이번 범위에서는 쓰지 않음) |
| 써보니의 통신판매중개자 해당 여부 | 해당 공식 해석 문서를 찾지 못함 | 판정 문장 없음 | 2026-10-26 | 미확인 — 개발 범위 제외. 보관 의무가 있다고 가정 |

## 8. 설계–코드 대조표
| 설계 문장 | 호출 함수(파일:행) | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴하면 로그인 불가 | app/src/lib/session.ts:53 `getCurrentUserId` | users | 없음 | 충돌 없음 |
| 탈퇴 시 쿠키 지움 | app/src/app/api/session/route.ts:58 `DELETE` | 없음 | 없음 | 충돌 없음 |
| 진행 중 거래 판정 | app/src/ui/trade-rules.ts:14 `FINAL_STATUSES`, app/src/lib/orders.ts:452 `advanceOrders` | orders, disputes | orders | 충돌 없음 |
| 경쟁 쓰기 장벽 | 신규 0018 트리거. 예: app/src/app/api/wishlists/route.ts:17, app/src/app/api/demand-intents/route.ts:33, app/src/app/api/seller-account/route.ts:29, app/src/app/api/push/route.ts:17의 쓰기가 트리거에 걸린다 | users | 6절 표 | 충돌 없음 |
| 판매자 쪽 새 주문 막기 | app/src/lib/orders.ts:193 조건부 예약 update | listings | listings | 충돌 없음 |
| 상대 알림 줄 바꿈 | app/src/lib/notify.ts:40 `notifyTx`가 notifications에 쓴 줄 중 정확히 일치하는 줄만 | notifications | notifications | 충돌 없음 |
| 탈퇴자에게 알림 줄을 쓰지 않음 | app/src/lib/notify.ts:40 `notifyTx`에 ACTIVE 확인 추가(이 함수는 notifications에 쓴다) | users | notifications | 충돌 없음 |
| 파일 경로 구하기 | app/src/lib/photos.ts:24 `photoPath`(경로만 계산), 실제 이동·삭제는 신규 `afterWithdraw`·`purgeExpired` | 없음 | 파일 시스템 | 충돌 후 해소: app/src/lib/photos.ts:52 `removeOrderPhotoFile`은 오류를 삼켜 쓰지 않는다 |
| 이름 익명화 | app/src/lib/chat.ts:50, app/src/lib/reviews.ts:105 | users | users | 충돌 없음 |
| 보관 DB 분리 | 신규 lib/retain.ts. 기존 app/src/db/client.ts:6 WAL 설정은 운영 DB 그대로 둔다 | retained.db | retained.db | 충돌 없음 |
| 보관 키 분리 | 신규 RETAIN_SECRET. 기존 app/src/lib/crypto-box.ts:5는 SESSION_SECRET 기반이라 쓰지 않는다 | 없음 | 없음 | 충돌 없음 |
| 의견 본문 30일 | app/src/app/api/feedback/route.ts:28이 metadata.message를 저장 → 신규 purgeExpired가 30일 뒤 비움 | market_validation_events | market_validation_events | 충돌 없음 |
| 자동 파기 | app/src/lib/jobs.ts:85 `runJobs`에 신규 `purgeExpired` | retained.db | retained.db, withdrawals, market_validation_events, 파일 시스템 | 충돌 없음 |
| 예약 닉네임 | app/src/lib/session.ts:31 `cleanNickname` | 없음 | 없음 | 충돌 없음 |
| 찜 수 | app/src/lib/admin-metrics.ts:28, app/src/app/me/page.tsx:94 | wishlists, listings | 없음 | 충돌 없음 |
| 탈퇴 화면 | app/src/app/me/account/page.tsx:15 | users, orders | 없음 | 충돌 없음 |

## 9. 값 출처표
| 값 | 출처구분 | 근거 |
|---|---|---|
| 상품 글·사진 6개월 | 공식 문서 | 시행령 제6조 제1항 제1호 |
| 계약·결제·공급 기록 5년 | 공식 문서 | 같은 항 제2·3호 |
| 분쟁 기록 3년 | 공식 문서 | 같은 항 제4호 |
| 의견 본문 30일 | 제안(승인 필요) | 운영자 확인 기간. 사용자 "스스로 판단" 위임 |
| 백업 30일 | 제안(승인 필요) | 같음 |
| 확인 문구 "탈퇴합니다" | 제안(승인 필요) | 같음 |
| 가명 16바이트 | 제안(승인 필요) | 같음 |

## 10. 권한 범위
| 누가 | 할 수 있는 것 |
|---|---|
| 본인 | 자기 계정만 탈퇴 |
| 다른 사용자 | 탈퇴자와 새 채팅·제안·주문 불가(트리거) |
| 운영자 | 탈퇴 수·탈퇴로 내린 상품 수만 본다. 보관 자료는 볼 수 없다 |

## 11. 실패·원복표
| 실패 | 처리 |
|---|---|
| 탈퇴 트랜잭션 중간 오류 | 전부 롤백, 운영 DB 변경 0 |
| 보관 DB 쓰기 실패 | 운영 DB 트랜잭션 전에 보관 DB에 먼저 쓴다(같은 보관 id). 운영 DB 트랜잭션이 실패하면 그 보관 id 줄을 지운다 |
| 파일 이동·삭제 실패 | 보관 DB에 남겨 다음 파기 작업에서 다시 시도 |
| 진행 중 거래 | 409 + 목록 |
| 동시 요청 | 조건부 update로 한 번만 실행 |
| 기능 꺼짐 | 503, 버튼 숨김 |

## 12. 시험 (합격 기준과 번호 연결)
| 번호 | 시험 | 일부러 틀린 입력·오류 주입 |
|---|---|---|
| T1 | 탈퇴 → 로그인 불가, 상대 화면·알림에 원래 닉네임 0건 | 쿠키를 다시 써도 비로그인 |
| T2 | 진행 중 거래 → 409 | 기한 지난 AWAIT_PAYMENT는 advanceOrders 뒤 막지 않음 |
| T3 | 판매자 탈퇴: 상품 REMOVED·SOLD 유지·남의 제안 취소·알림 | - |
| T4 | 구매자 탈퇴: 주문 칸 바뀜, 보관 DB에 원래 값, 판매자 화면에 원래 값 0건 | - |
| T5 | 즉시 삭제 대상 8개 표가 0줄 | - |
| T6 | 4절 표의 모든 칸을 하나씩 확인(SQL로 원래 값 0건) | 탈퇴 전에 각 칸에 표시 문자열을 심어 두고 탈퇴 뒤 운영 DB 전체에서 0건 |
| T7 | 쓰기 장벽: 25개 API의 대상 표마다 WITHDRAWN 사용자로 INSERT → USER_INACTIVE | 탈퇴 직전에 요청을 시작하고 직후에 커밋되게 순서를 바꿔 2번 실행 |
| T8 | 동시 탈퇴 요청 2개 → withdrawals 1줄 | - |
| T9 | 트랜잭션 중간 오류 주입(시험 전용 환경변수 WITHDRAW_FAULT=after_listings) → 운영 DB 변경 0, 보관 DB 줄 정리 | - |
| T10 | 파일 삭제 실패 주입(파일 잠금) → 보관 DB에 남고, 다음 작업 뒤 파일 없음 | - |
| T11 | 파기 시각 경계: 6개월·3년·5년·30일 각각 기한 1초 전 그대로, 1초 뒤 파기 | - |
| T12 | 파기 뒤 retained.db와 운영 DB 파일 바이트에서 표시 문자열 0건(secure_delete·WAL 정리 확인) | secure_delete를 끈 경우 문자열이 남는 것을 먼저 보여 준다 |
| T13 | 키 교체: 섞인 키 버전 읽기, 중간 실패 뒤 다시 실행 | - |
| T14 | 기능 꺼짐 → 503, 버튼 없음 | - |
| T15 | 지표: 보는 사람 수는 같고, 찜·찾는 사람 수는 탈퇴자 몫만 줄어듦 | - |
| T16 | 보관 자료가 화면·관리자 CSV·API에 안 나옴(문자열 검색) | - |
| T17 | 닉네임이 "구매자"인 사람이 탈퇴해도 상대의 다른 알림은 그대로 | - |
| T18 | 확인 문구 틀림 400, 남의 id 무시, 예약 닉네임 거절 | 모두 틀린 입력 |
| T19 | 화면: PC 1280px·모바일 375px 실제 브라우저, 스크린샷 | - |
| T20 | 회귀: 기존 e2e 3묶음·단위 시험 전체 | - |

## 13. 합격 기준
| 기준 | 시험 |
|---|---|
| 로그인 불가·개인 정보 비노출 | T1, T4, T6, T16, T17 |
| 진행 중 거래·한 번만 실행·경쟁 | T2, T3, T7, T8 |
| 법정 보관·파기·복구 불가 | T11, T12, T13 |
| 실패 처리 | T9, T10, T14 |
| 지표 | T15 |
| 틀린 입력 | T18 |
| 화면·회귀 | T19, T20 |
| 원복 | 시험 전 스냅숏과 비교해 차이 0 |

## 14. 운영 요건·권한·막힘 대응표, 보호 목록
| 항목 | 내용 |
|---|---|
| 필요 권한 | 운영 반영(83절 ③), RETAIN_SECRET 등록(④), 30일 넘은 백업 삭제(②) |
| 항상 사람이 할 일 | 비밀값 등록, 운영에서 WITHDRAW_ENABLED=1 켜기 |
| 막힘 → 대처 | 보관 DB를 열 수 없으면 탈퇴 API 503(개인정보를 잃지 않게 막는다) |
| 긴급 정지 | WITHDRAW_ENABLED 제거 |
| 막힘 재현 시험 | T9, T10, 보관 DB 파일 권한 제거 후 503 |
| 보호 목록(개발 중 건드리지 않음) | 2026-10-26 19:30 기준 `git status`의 45항목 중 3절 파일 목록에 없는 것 전부. app/src의 기존 변경 4개(admin/page.tsx, admin/ChatLog.tsx, ui/trial-pricing.ts, ui/trial-pricing.test.ts)는 별도 작업(채팅 "입금" 완화·시험 서버 채팅 보기)이라 탈퇴 커밋과 섞지 않는다 |

## 15. 선행 시험·범위 동결
- 선행 시험: 개발 첫 단계에서 운영 복사 DB의 사용자·진행 중 거래·남의 제안 수를 읽기 전용으로 센다. 트리거 1개를 복사 DB에 만들어 실제로 막히는지 먼저 본다.
- 발견 목록(범위 밖): 카카오 원격 연결 끊기, 운영자 강제 탈퇴, 경쟁 경우 응답 409 통일, 상품 등록 글 연락처 검사.
- 미룬 확인: 0건(SQLite secure_delete·WAL 비우기 공식 문장은 2026-10-26 확인해 7절에 적음).

## 16. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 유지 |
|---|---|---|---|
| 코드 되돌림 + 0018_down.sql | 트리거·withdrawals 표 | retained.db 파일은 남는다(지우려면 승인) | 탈퇴자는 WITHDRAWN이라 옛 코드에서도 로그인 불가 |
| 백업 삭제 | 30일 넘은 백업 | 없음 | 해당 없음(되돌릴 수 없어 승인 대상) |

## 17. 예상 지적
- 경쟁 경우 응답이 500이다. → DB 변경 0을 우선했고, 응답 통일은 발견 목록에 둔다.
- 후기 본문을 남기는 근거 → 공개 후기, 작성자 익명화, 연락처 검사 후 비움.
- 같은 서버 디스크에 보관 DB를 둔다. → 별도 파일·별도 키·읽는 함수 제한으로 분리한다. 다른 서버로 옮기는 것은 범위 밖이다.
