프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261028-1137 · 작성 일시: 2026-10-28 11:37:15 KST
기준 지시: 2026-10-28 사용자 "탈퇴 입구 유지하고 2단계 진행" + "권장안"(L1 법정 보관 적용·운영 켜기 전 법률 검토, 백업 30일) · 버전: v8(탈퇴 2단계 계획 — 법정 분리 보관·파기·쓰기 장벽·사진 차단·백업 정리) (이전 v7(탈퇴 1단계 확정 계획)) · 이전 버전과 같은지: 다름(1단계 위에 덧붙이는 2단계)
일의 크기: 대 — 운영 DB 구조 변경(트리거·표 추가), 탈퇴 때 거래 기록 이동·파기, 운영 서버 백업 삭제

# 탈퇴 2단계 계획 v8

참조 규칙: E:\PROJECT_CONTROL_CENTER\00_공통\PLANNING_RULES_v3.md, 38절(기획 규칙 6단계), 41절(기획 규칙 v3 보강), 53절(미룸 0건·서버 실측), 63절(검수 왕복 3번), 65절(기획 3단계), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만), 93절(개발 전 의견 보고 후 진행).
개발 전 의견: docs/review/CODEX_OPINION_RESULT_WITHDRAW_STAGE2_v1.raw.txt(Codex), E:\PROJECTS\_work\reports\2026-10-28_탈퇴2단계_개발전의견.md(Claude 검토·요약).

## 0. 결정과 범위
| 항목 | 내용 |
|---|---|
| 사용자 결정 L1 | 시행령 제6조 보관 기준을 적용해 설계한다. 운영에서 WITHDRAW_ENABLED를 켜기 전에 법률 검토로 확정한다(켜는 것은 별도 승인) |
| 사용자 결정 2 | 운영 서버 DB 백업은 30일 보관 |
| 1단계와의 관계 | 1단계(f25a1d7)의 탈퇴 화면·API·blockersOf·withdrawUser는 그대로 쓰고 고친다. 새로 만들지 않는다(Codex 의견 1) |
| 2단계가 하는 일 | ① 거래 기록 속 개인정보를 보관 DB로 옮기고 원래 칸 비우기 ② 기간이 지나면 보관분 파기 ③ 탈퇴자 이름으로 새 쓰기가 생기지 못하게 DB 트리거 ④ 탈퇴자 상품 사진 공개 주소 차단 ⑤ 백업 30일 정리 ⑥ 안내 문구를 실제 동작에 맞춤 |
| 빼는 것(참고) | 카카오 원격 연결 끊기, 탈퇴 요청 횟수 제한, 운영자 강제 탈퇴, 응답 코드 500→409, 관리자 화면 탈퇴 지표, 키 교체 기능(키 버전 칸만 둔다) |

## 1. 완성 지도
- 완성 정의
  - 탈퇴하면 1단계 동작(로그인 차단·이름 가리기·내 데이터 8종 삭제·상품 내림·진행 중 거래 막기)에 더해, 아래 일이 일어난다.
    - 거래 기록 속 개인정보가 운영 DB에서 사라지고 보관 DB(`runtime-data/retained.db`, 별도 키)에만 남는다.
    - 탈퇴자 상품 사진 주소는 바로 404가 된다.
  - 보관분은 기록 종류별 기한(6개월·5년·3년)이 지나면 정기 작업이 복구할 수 없게 지운다.
  - 탈퇴가 커밋된 뒤에는 그 사용자 이름으로 어떤 표에도 새 줄이 생기지 않는다(DB가 거절).
  - 운영 서버 백업은 30일 지난 것을 지운다.
- 현재 위치: 1단계 커밋 f25a1d7. 시뮬레이션 서버(localhost:3200)에서만 켜져 있고 운영은 꺼져 있다.
- 개발 순서
  1. DB 이전 0019(withdrawals·트리거)
  2. 보관 DB 모듈
  3. 탈퇴 처리 2단계(보관 이동 상태기계)
  4. 사진 차단·이동
  5. 파기 작업
  6. 문구
  7. 백업 정리 스크립트
  8. 시험
  9. Codex 코드 검수
  10. 운영 반영(승인)
- 필요한 승인(83절(승인은 4가지만))
  - 운영 반영 1회(③ 되돌릴 수 없는 변경 — 트리거·표 추가)
  - 운영 서버 비밀값 `RETAIN_SECRET` 등록(④)
  - 첫 백업 정리 실행 때 30일 넘은 백업 삭제(② 영구 삭제)
  - 운영에서 WITHDRAW_ENABLED=1로 켜기(L1 법률 검토 뒤, ③)
- 되돌리기
  - 코드는 이전 커밋으로 되돌린다.
  - 0019는 `app/drizzle/rollback/0019_down.sql`로 트리거·표를 지운다.
  - 실제 탈퇴로 옮기거나 지운 데이터는 되돌릴 수 없다. 그래서 운영에서는 꺼 둔 채 반영하고, 시뮬레이션 서버에서 끝까지 시험한다.

## 2. 처리 방식 — 보관 이동 상태기계 (Codex 의견: 두 DB 사이 서버 종료 복구)
| 상태(withdrawals.stage) | 언제 | 다음으로 가는 조건 |
|---|---|---|
| (없음) → RETAIN_PENDING | 1단계 탈퇴 트랜잭션 안에서 withdrawals 줄을 같이 쓴다 | 커밋 직후 같은 요청에서 retainUser 실행 |
| RETAIN_PENDING → RETAINED | retainUser: ① 운영 DB에서 대상 값 읽기 ② 보관 DB에 `INSERT OR REPLACE`(키 = 원천 표·원천 id·칸, 몇 번 해도 같은 결과) 커밋 ③ 사진 파일을 보관 폴더로 복사·fsync, 보관 DB에 파일 줄 기록 ④ 운영 DB 한 트랜잭션에서 원래 칸 비우기·사진 줄 삭제·stage=RETAINED ⑤ 원본 사진 파일 unlink | ①~④ 성공 |
| 실패·서버 종료 | 어느 단계든 중간에 멈춤 | 정기 작업(10분마다, jobs.ts:105)이 RETAIN_PENDING을 찾아 retainUser를 다시 실행. ②는 덮어쓰기라 중복이 생기지 않고, ④는 stage 조건(`stage='RETAIN_PENDING'`)이 있어 한 번만 적용된다 |
| 원본 파일 unlink 실패 | ⑤ | 보관 DB 파일 줄에 `src_removed=0`을 남기고 정기 작업이 다시 지운다(Codex 의견: unlink 실패 무시 금지) |
| RETAINED → PURGED | 보관분이 모두 기한 지나 파기되면 | withdrawals 줄을 지운다 |
- RETAIN_PENDING 동안(보통 1초 미만, 최악 10분) 거래 상대 화면에 원래 값이 보인다. 탈퇴자는 이미 로그아웃·로그인 차단 상태다. 이 창은 받아들인다(14절 막힘 대응표).

## 3. 개인정보 위치 전수표 (2단계 처리) — 근거: app/src/db/schema.ts, 1단계 처리 근거: app/src/lib/withdraw.ts
| 위치(schema 행) | 분류 | 2단계 처리 | 보관 기간 시작 |
|---|---|---|---|
| listings.title·description·check_items(70·73·79) 탈퇴자 상품 전부(SOLD 포함) | 법정 보관 1호(표시·광고) | 보관 DB로 옮기고 원래 칸을 "탈퇴한 판매자의 상품"·""·null | 탈퇴일 |
| listing_photos 줄·파일(92) | 법정 보관 1호 | 파일 보관 폴더로 이동, 줄 삭제 | 탈퇴일 |
| listing_trial_terms.condition_note(111) | 법정 보관 1호 | 옮기고 null | 탈퇴일 |
| orders.snapshot(218) | 2호(계약) | 옮기고 `{"title":…}`만 남긴 최소 스냅숏 | 주문 끝난 날(없으면 탈퇴일) |
| orders.questions·return_note·cancel_reason(225·232·244) | 2호 | 쓴 쪽이 탈퇴하면 옮기고 null(questions는 구매자, return_note는 구매자, cancel_reason은 기록상 작성자 구분이 없어 양쪽 중 누가 탈퇴해도 옮김) | 같음 |
| orders.deposit_name·ship_enc·refund_enc(226-228) | 3호(결제·공급) | 구매자 탈퇴 때 옮기고 "탈퇴한 사용자"·""(NOT NULL)·null | 같음 |
| orders.seller_account_enc(246) | 3호 | 판매자 탈퇴 때 옮기고 null | 같음 |
| orders.ship_tracking(230)·return_tracking(234) | 3호 | ship은 판매자, return은 구매자가 탈퇴하면 옮기고 null | 같음 |
| orders.arrival_check·pack_check(237-238) | 3호 | 구매자 탈퇴 때 JSON 전체를 옮기고, 원래 칸에는 구성품 결과만 남김(메모·사진 이름 제거) | 같음 |
| orders.inspection(236) | 3호 | 판매자 탈퇴 때 같은 방식 | 같음 |
| order_photos 줄·파일(270) | 3호, 분쟁에 쓰였으면 3호·4호 중 긴 쪽 | 탈퇴자가 올린 것만 파일 이동·줄 삭제 | 같음 |
| order_events.data(287) | 3호 | 운송장 번호 키가 있으면 그 키만 옮기고 지움. actor_id는 익명화된 users를 가리켜 그대로 | 같음 |
| disputes.detail(297) | 4호(분쟁) | 개설자가 탈퇴하면 옮기고 null. resolution은 운영자 글이라 유지 | 분쟁 정리일(없으면 탈퇴일) |
| chat_messages.body(156) USER 종류, 주문이 있었던 방 | 2호 | 옮기고 원래 본문 "(탈퇴한 사용자의 메시지)" | 그 방 주문이 끝난 날 |
| chat_messages.body USER 종류, 주문 없는 방 | 보존 근거 없음 | 탈퇴 트랜잭션에서 바로 "(탈퇴한 사용자의 메시지)"(보관 안 함) | — |
| reviews.body(315), trial_reviews.answers·reason·learned·fit_for(329-332) | 익명화 후 유지 | 탈퇴 때 findContactInfo(app/src/ui/trial-pricing.ts:127)로 검사, 걸린 칸만 null | — |
| market_validation_events.metadata(194) FEEDBACK.message | 보존 근거 없음 | 탈퇴자 것은 탈퇴 때 비움 | — |
| metadata CHAT_REPORT.reportedUserId, LOGIN_LINK_ISSUED.userId | 익명화 | 탈퇴 때 그 이벤트의 가명(1단계가 user_id에 쓴 wd_ 값)과 같은 값으로 바꿈 | — |
| 운영 DB 백업 | 보존 근거 없음 | 30일 지난 백업 삭제(ops/backup_prune.sh) | — |
- 1단계가 이미 처리한 것(로그인 연결·로그인 링크·정산 계좌·찜·수요·내 알림·푸시·알림 설정, 이름·사진, 써보기 제안 글, 상대 알림 2종, 이벤트 user_id)은 바꾸지 않는다.

## 4. 법정 보관 기간과 파기
| 기록 종류(시행령 제6조 제1항) | 기간 | 대상(3절) |
|---|---|---|
| 1호 표시·광고 | 6개월 | 상품 글·사진·조건 메모 |
| 2호 계약·청약철회 | 5년 | 스냅숏·질문·반품 메모·취소 사유·주문 있는 방 채팅 |
| 3호 대금결제·재화 공급 | 5년 | 입금자명·배송지·계좌·운송장·확인 기록·거래 사진·거래 기록 운송장 |
| 4호 불만·분쟁 | 3년 | 분쟁 상세(같은 자료가 5년 대상이면 긴 쪽) |
- 보관 DB
  - `runtime-data/retained.db`, `runtime-data/retained/`(사진 파일)에 둔다. 운영 컨테이너에 이미 붙어 있는 볼륨이다(ops/deploy.sh:18).
  - 열 때 `journal_mode=DELETE`, `secure_delete=ON`을 쓴다. WAL 파일에 잔재가 남지 않게 하려는 것이다.
  - 값은 AES-256-GCM으로 암호화한다. 키는 `RETAIN_SECRET`에서 HKDF로 만든다. 형식은 crypto-box.ts:12와 같고 앞에 키 버전 `r1`을 붙인다.
  - 읽는 함수는 파기 함수뿐이다. 화면·관리자 CSV·API에서는 읽지 않는다.
- 파기(purgeRetained, runJobs에 단계 추가)
  - expires_at이 지난 줄을 지운다.
  - 파일은 unlink한 뒤 존재 여부를 다시 확인한다. 실패하면 줄을 남겨 다음 실행에서 다시 지운다.
  - 지운 줄이 있으면 보관 DB에 VACUUM을 실행한다.
- 운영 DB
  - 연결에 `secure_delete=ON`을 더한다(client.ts:6-7).
  - retainUser ④ 뒤에 `wal_checkpoint(TRUNCATE)`를 실행한다. WAL 파일에 원래 값이 남지 않게 하려는 것이다(Codex 의견 3).
- 백업
  - deploy.sh는 --migrate일 때 운영 DB 백업을 만든다(ops/deploy.sh:20).
  - 2단계에서는 같은 자리에 retained.db 백업을 더하고, `ops/backup_prune.sh`로 30일 넘은 백업을 지운다(find -mtime +30).

## 5. 쓰기 장벽 (0019 트리거) — Codex 의견 3·Claude 검토 2 반영
- 사용자 칸 표: BEFORE INSERT 트리거를 둔다. 그 줄의 사용자가 ACTIVE가 아니면 `RAISE(ABORT,'USER_INACTIVE')`로 거절한다. 대상 표·칸은 아래 13개 표다(schema에 모두 있음, Claude 검토 2).
  - wishlists.user_id, demand_intents.user_id, seller_accounts.user_id, push_subscriptions.user_id, notification_prefs.user_id
  - notifications.user_id, login_links.user_id, social_accounts.user_id
  - chat_messages.sender_id(kind='USER'만), chat_threads.buyer_id·seller_id, trial_proposals.buyer_id, orders.buyer_id·seller_id
  - order_photos.user_id, disputes.opener_id, reviews.writer_id, trial_reviews.writer_id, xp_awards.user_id
- market_validation_events.user_id: 'wd_'로 시작하는 가명과 null은 통과시킨다.
- listings
  - INSERT: seller가 ACTIVE가 아니면 거절한다.
  - UPDATE: seller가 WITHDRAWN이고 NEW.status가 ACTIVE·HIDDEN·RESERVED 중 하나면 거절한다. REMOVED·SOLD로 내용만 비우는 갱신은 통과한다. v4(탈퇴 전체 설계 초안)는 SOLD 상품 비우기까지 막았는데, 이 판에서 고쳤다(Codex 의견 3).
- listing_photos INSERT: 그 상품의 seller가 ACTIVE가 아니면 거절한다.
- users UPDATE: OLD.status='WITHDRAWN'이고 다음 중 하나면 거절한다. 이렇게 하면 이름 바꾸기와 탈퇴가 겹쳐도 이름이 되살아나지 않는다.
  - NEW.status가 'WITHDRAWN'이 아님
  - NEW.nickname이 '탈퇴한 사용자'가 아님
  - NEW.kakao_image_url이 null이 아님
  - NEW.show_photo가 0이 아님
- 트리거 대상 표에 쓰는 지점은 실측한 쓰기 호출 목록에 있다(Grep `.insert|update|delete(<표>)`, 8절 대조표).
  - 정상 경로에서는 탈퇴자가 session.ts:60에서 먼저 401로 막힌다.
  - 트리거는 그 검사를 지난 직후에 탈퇴가 커밋되는 경우만 막는다. 그때 응답은 500이고 DB 변경은 0이다(409로 바꾸는 일은 참고사항).

## 6. 사진 공개 주소 차단 (Claude 검토 3)
- `app/src/app/api/photos/[file]/route.ts:9-18`
  - 파일을 읽기 전에 `listing_photos` 줄이 있는지 확인하고, 없으면 404를 돌려준다. 2단계가 줄을 지우고 파일을 옮기므로 탈퇴 즉시 404가 된다.
  - 캐시 헤더를 `public, max-age=86400`(1일)로 바꾸고 immutable은 뺀다. 이미 퍼진 사본은 회수할 수 없으니, 앞으로 남는 기간만 1일로 줄인다.
- 주문 화면의 스냅숏 사진(orders.snapshot.photo)
  - 판매자가 탈퇴한 뒤에는 사진 주소가 404가 된다.
  - 주문 화면은 사진이 없을 때 자리표시 화면을 보여 주는지 시험한다(T22).

## 7. 파일
| 파일 | 상태 | 역할 |
|---|---|---|
| app/drizzle/0019_withdraw2.sql + meta/0019_snapshot.json·_journal.json | 신규·수정 | withdrawals 표(user_id, stage, withdrawn_at), 5절 트리거 |
| app/drizzle/rollback/0019_down.sql | 신규 | 되돌리기 |
| app/src/db/schema.ts | 수정 | withdrawals 정의 |
| app/src/db/client.ts | 수정 | secure_delete=ON |
| app/src/lib/retain.ts | 신규 | 보관 DB 열기·암호화·넣기·파기 |
| app/src/lib/withdraw.ts | 수정 | 탈퇴 트랜잭션에 withdrawals 줄·주문 없는 방 채팅·후기 연락처·이벤트 metadata, retainUser(2절) |
| app/src/app/api/me/withdraw/route.ts | 수정 | 커밋 뒤 retainUser 호출(실패해도 탈퇴 응답은 성공, 정기 작업이 이어서 함) |
| app/src/app/api/photos/[file]/route.ts | 수정 | 6절 |
| app/src/lib/photos.ts | 수정 | 보관 폴더로 이동하는 함수, unlink 결과 확인 |
| app/src/lib/jobs.ts | 수정 | runJobs에 retainPending·purgeRetained 단계 |
| app/src/lib/notify.ts | 수정 | 알림 줄을 쓰기 전(notify.ts:57) 받는 사람이 ACTIVE인지 확인하고 아니면 건너뛴다. 이것이 없으면 거래 상대의 정상 동작(후기 알림 등)이 notifications 트리거에 걸려 그 트랜잭션 전체가 실패한다 |
| app/src/app/withdrawn/page.tsx, me/account/WithdrawForm.tsx | 수정 | 안내 문구: "거래 기록은 법에 따라 따로 보관했다가 기간이 지나면 지워요" |
| ops/backup_prune.sh, ops/deploy.sh | 신규·수정 | 30일 정리, retained.db 백업 |
| ops/e2e/suites/test_withdraw.py, ops/e2e/unit/withdraw2.sh(가칭) | 수정·신규 | 9절 시험 |

## 사전 조사 생성표
생성표: docs/review/survey/withdraw2_state.md sha256:188a23178bb391e9379bc3f2800b4ce5cfb4f11687d170571a760388755526d7
생성표: docs/review/survey/withdraw2_literal_withdraw.md sha256:8860f84d34a18eb892dd0ded33a510938ce4029390104a349bd7b988dcbbcc84
생성표: docs/review/survey/withdraw2_literal_photos.md sha256:7dbc2066c140112deb8bc82ce6fe0f11e657d6fef30137de75919e1897c99ce0
조사 생략: ui — 새 화면·버튼·탭이 없고 기존 탈퇴 안내 문구 2곳(withdrawn/page.tsx, WithdrawForm.tsx)만 바꾼다
조사 생략: config — app/.env는 비밀값 파일이라 자동 모드가 읽기를 막았다(2026-10-28 11:3x). 2단계는 새 설정 RETAIN_SECRET 1개만 더하고, 기존 WITHDRAW_ENABLED(withdraw.ts:28)·SESSION_SECRET(crypto-box.ts:6)은 코드에서 확인했다
- state 표 한계: 생성 도구는 SQL 문자열만 읽어 drizzle 쓰기(`.insert(표)`)를 0으로 셌다. 쓰기 지점은 Grep으로 따로 실측해 8절 대조표에 썼다.
- photos 이름표 한계: --exclude가 `.next.codex-review-20261027`(옛 빌드 결과)와 drizzle/meta를 빼지 못해 F001-F064에 들어 있다.
- 두 이름표는 ID가 둘 다 F001부터라, 아래 판단 표를 표 이름별로 나눠 쓴다.

### 공유 상태 지도(withdraw2_state.md) 판단
| ID | 판단 | 이유 |
|---|---|---|
| S001-S002 | 해당없음 | SQL 문장 속 낱말(answered, better)이 표 이름으로 잡힌 것 |
| S003 | 해당없음 | categories는 개인정보 없음 |
| S004-S005 | 변경 | chat_messages 본문 보관·교체, chat_threads INSERT 트리거 |
| S006 | 유지 | demand_intents는 1단계가 이미 삭제, 2단계는 INSERT 트리거만 |
| S007 | 변경 | disputes.detail 보관, INSERT 트리거 |
| S008 | 해당없음 | drizzle 라이브러리 이름 |
| S009 | 변경 | listing_photos 줄 삭제·파일 이동, INSERT 트리거 |
| S010 | 변경 | listing_trial_terms.condition_note 보관 |
| S011 | 변경 | listings 내용 보관·UPDATE/INSERT 트리거 |
| S012 | 변경 | market_validation_events metadata 정리, 가명 통과 트리거 |
| S013-S014 | 해당없음 | next·node 라이브러리 이름 |
| S015 | 유지 | notifications는 1단계 처리, INSERT 트리거만 |
| S016 | 변경 | orders 개인정보 칸 보관·비우기, INSERT 트리거 |
| S017 | 해당없음 | product_models는 개인정보 없음 |
| S018 | 유지 | push_subscriptions는 1단계 삭제, INSERT 트리거만 |
| S019 | 변경 | reviews 연락처 검사, INSERT 트리거 |
| S020 | 해당없음 | sharp 라이브러리 이름 |
| S021 | 유지 | trial_proposals 글은 1단계 처리, INSERT 트리거만 |
| S022 | 변경 | users UPDATE 트리거 |
| S023 | 해당없음 | web 낱말 |
| S024 | 유지 | wishlists는 1단계 삭제, INSERT 트리거만 |

### 기존 이름 전수(withdraw2_literal_withdraw.md, 검색어 withdraw) 판단
| ID | 판단 | 이유 |
|---|---|---|
| F001 | 유지 | 채팅의 탈퇴 상대 확인(chats/[id]/route.ts:48·63)은 그대로 둔다 |
| F002 | 변경 | 커밋 뒤 retainUser 호출 |
| F003 | 유지 | 탈퇴 화면 스타일 그대로 |
| F004 | 변경 | 안내 문구 한 줄 |
| F005-F006 | 유지 | 탈퇴 입구·폼 위치 그대로(사용자 결정 2026-10-28) |
| F007 | 변경 | 완료 화면 안내 문구 |
| F008 | 변경 | withdrawals 표 정의 추가 |
| F009 | 유지 | 세션의 탈퇴 판정 그대로 |
| F010 | 변경 | 2단계 처리 추가 |

### 기존 이름 전수(withdraw2_literal_photos.md, 검색어 photos) 판단
| ID | 판단 | 이유 |
|---|---|---|
| F001-F044 | 해당없음 | (photos 표의 F001-F044) 옛 빌드 결과 폴더(.next.codex-review-20261027) — 소스 아님 |
| F045-F064 | 유지 | 옛 DB 이전 파일과 스냅숏. 새 0019만 더한다 |
| F065 | 유지 | next.config 이미지 설정, 주소 형식 그대로 |
| F066 | 해당없음 | 당근 가져오기 스크립트(시험 데이터용) |
| F067 | 유지 | 공유 이미지(og)는 상품 사진 경로를 거쳐 6절 차단을 그대로 받는다 |
| F068 | 유지 | 상품 사진 올리기 — 트리거가 탈퇴자 쓰기를 막는다 |
| F069 | 유지 | 상품 수정 API — 트리거가 막는다 |
| F070-F071 | 유지 | 거래 증거 사진 열기·올리기, 당사자 확인 그대로. 탈퇴자 사진은 2단계가 옮긴다 |
| F072 | 변경 | 6절 공개 사진 차단 |
| F073-F078 | 유지 | 화면에서 사진 주소를 쓰는 곳. 404가 되면 기존 빈 사진 처리를 탄다(T22에서 확인) |
| F079-F082 | 유지 | 주문 화면·갤러리·단계 사진 — T22 확인 |
| F083 | 유지 | schema 사진 표 정의 그대로 |
| F084-F085 | 유지 | 채팅·주문의 사진 참조 그대로 |
| F086 | 유지 | 사진 주소 만들기 그대로 |
| F087 | 변경 | 보관 폴더 이동·unlink 결과 확인 |
| F088-F090 | 유지 | 조회·점검표·시험의 사진 참조 그대로 |

## 8. 설계–코드 대조표
| 설계 문장 | 호출 함수 | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴 트랜잭션에 withdrawals 줄 추가 | withdrawUser app/src/lib/withdraw.ts:66 | users | withdrawals | 충돌 없음 — 1단계 "트랜잭션 하나만 남긴다"(v7 00절 1)를 지킨다 |
| 커밋 뒤 보관 이동 | 신규 retainUser(withdraw.ts), 호출 app/src/app/api/me/withdraw/route.ts:15 | orders, listings, chat_messages, disputes, order_photos, listing_photos | retained.db, orders, listings, chat_messages, disputes, order_photos, listing_photos, withdrawals | 충돌 후 해소 — 1단계는 요청 안 변경을 탈퇴 트랜잭션 하나로 묶었지만, 2단계 이동은 커밋 뒤 따로 하고 실패해도 정기 작업이 재시도한다(2절) |
| 정기 작업 재시도·파기 | runJobs app/src/lib/jobs.ts:85 | withdrawals, retained.db | retained.db, withdrawals | 충돌 없음 — step 함수가 실패를 다른 단계와 분리한다(jobs.ts:87) |
| 공개 사진 차단 | GET(app/src/app/api/photos/[file]/route.ts 9행 — 대괄호 경로라 점검 도구가 못 읽어 행 표기로 씀), 파일 읽기 readPhoto app/src/lib/photos.ts:46 | listing_photos, order_photos | 없음 | 충돌 없음 — 거래 증거 사진 거절(11행)은 유지 |
| 사진 이동·삭제 확인 | 신규 movePhotoToRetained, 기존 deletePhoto app/src/lib/photos.ts:82 | listing_photos | listing_photos | 충돌 후 해소 — 기존 unlink 실패 무시(photos.ts:53·88)는 상품 수정용으로 두고, 탈퇴 경로만 결과를 확인한다 |
| 운영 DB secure_delete | app/src/db/client.ts:6 | 없음 | 없음 | 충돌 없음 |
| 암호화 형식 | seal app/src/lib/crypto-box.ts:12 참고, 신규 retainSeal | 없음 | retained.db | 충돌 없음 — 키를 SESSION_SECRET과 분리 |
| 후기 연락처 검사 | findContactInfo app/src/ui/trial-pricing.ts:127 | reviews, trial_reviews | reviews, trial_reviews | 충돌 없음 |
| 탈퇴자 쓰기 거절 | 신규 0019 트리거, 기존 검사 app/src/lib/session.ts:60 | users | 없음(거절) | 충돌 없음 |
| 이름 갱신 경쟁 | 이름·사진 갱신 app/src/app/api/session/route.ts:40, app/src/app/api/profile-photo/route.ts:13, app/src/lib/kakao.ts:76 | users | users | 충돌 없음 — 트리거가 탈퇴 뒤 갱신만 거절 |
| 상품 내용 비우기 | 1단계 상품 내림 app/src/lib/withdraw.ts:126 | listings | listings | 충돌 후 해소 — UPDATE 트리거가 REMOVED·SOLD 갱신은 통과(5절) |
| 백업 | ops/deploy.sh:20 | 없음 | 서버 /opt/sseoboni/backups | 충돌 없음 — 백업 만드는 줄은 그대로, 정리만 더한다 |

## 9. 시험 (합격 기준 번호 연결)
- 1단계 시험 T1~T14와 회귀 시험은 그대로 다시 돌린다(시험 서버, 기대: 탈퇴 135/0, 회귀 105/0).
- 2단계 새 시험은 아래와 같다. 모두 시뮬레이션 서버의 사본 DB에서 한다.

| 번호 | 시험 | 실패해야 하는 조건(84절(실패 가능 증거)) | 합격 기준 |
|---|---|---|---|
| T15 | 끝난 거래가 있는 구매자 탈퇴 뒤 orders 개인정보 칸 | 칸 하나라도 원래 값이 남음 | K1 |
| T16 | 같은 사용자의 보관 DB 줄 수·복호화 값이 원래 값과 같음 | 보관 줄 없음 또는 값 다름 | K2 |
| T17 | retainUser를 ② 뒤에 강제로 멈춘 뒤(시험용 인자) 정기 작업 1회 | stage가 RETAIN_PENDING에 남거나 보관 줄 중복 | K3 |
| T18 | 탈퇴 뒤 트리거: 탈퇴자 id로 13개 표에 직접 INSERT | 1건이라도 성공 | K4 |
| T19 | 탈퇴자 SOLD 상품 내용 비우기, REMOVED 유지 갱신 | 트리거가 막음 | K4 |
| T20 | 탈퇴 뒤 users 이름 되돌리기 UPDATE | 성공함 | K4 |
| T21 | 탈퇴 판매자 상품 사진 주소 | 200 | K5 |
| T22 | 상대방 주문 화면·상품 목록(PC 1280·모바일 375 스크린샷) | 화면 오류·깨진 이미지 아이콘 | K5 |
| T23 | 시계를 6개월+1일, 5년+1일 뒤로(nowMs 인자) 파기 | 기한 지난 줄·파일 남음, 기한 안 된 줄 지워짐 | K6 |
| T24 | 파기 뒤 retained.db·dev.db·-wal 파일 바이트에서 시험 표식 문자열 검색 | 표식 발견 | K6 |
| T25 | backup_prune.sh를 가짜 폴더(31일·29일 파일)로 실행 | 29일 파일 삭제 또는 31일 파일 남음 | K7 |
| T26 | 주문 없는 방 채팅·후기 연락처·FEEDBACK 메시지 | 원래 글 남음 | K1 |
| T27 | WITHDRAW_ENABLED 없음·0일 때 retainUser·purge 경로가 돌지 않음 | 꺼졌는데 실행됨 | K8 |
- 원복: 시험 전에 sim.db·retained.db·사진 폴더를 백업하고, 끝나면 복원해 차이 0을 확인한다(어제와 같은 방식).

## 10. 합격 기준
| 번호 | 기준 |
|---|---|
| K1 | 3절 표의 운영 DB 칸이 탈퇴 뒤 비거나 바뀜 |
| K2 | 같은 값이 보관 DB에만 암호문으로 있음 |
| K3 | 어느 단계에서 멈춰도 재시도 뒤 한 번만 적용됨 |
| K4 | 탈퇴 뒤 탈퇴자 이름의 새 줄 0, 내용 비우기는 통과 |
| K5 | 사진 404, 상대 화면 정상(PC·모바일 스크린샷) |
| K6 | 기한 지난 보관분이 파일 바이트에서도 사라짐 |
| K7 | 30일 정리가 정확히 동작 |
| K8 | 스위치가 꺼지면 2단계 경로도 꺼짐 |

## 11. 외부 서비스 근거표
| 항목 | 공식 문서 | 확인한 문장 | 확인일 | 상태 |
|---|---|---|---|---|
| 보관 기간 | https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=63460 | 제6조 제1항: 표시·광고 6개월, 계약 또는 청약철회 5년, 대금결제 및 재화등의 공급 5년, 소비자의 불만 또는 분쟁처리 3년 | 2026-10-28 | 확인 |
| 통신판매중개자 범위 | https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=63460 | 통신판매중개자는 자신의 정보처리시스템을 통하여 처리한 기록의 범위에서 거래기록을 보존 | 2026-10-28 | 확인 |
| 써보니가 통신판매중개자에 해당하는지 | 없음(법률 검토 필요) | 사용자 결정 L1로 적용 전제. 운영 켜기 전 법률 검토로 확정 | 2026-10-28 | 미확인 — 개발 범위 제외(운영 켜기 조건으로만 둠) |
| SQLite secure_delete | https://www.sqlite.org/pragma.html#pragma_secure_delete | "When secure_delete is on, SQLite overwrites deleted content with zeros." 제한은 가상 표뿐(써보니는 가상 표를 쓰지 않음) | 2026-10-28 | 확인 |
| SQLite wal_checkpoint(TRUNCATE) | https://www.sqlite.org/pragma.html#pragma_wal_checkpoint | "the WAL file is truncated to zero bytes upon successful completion" | 2026-10-28 | 확인 |

## 12. 값 출처표
| 값 | 출처 |
|---|---|
| 6개월·5년·3년 | 공식 문서(시행령 제6조 제1항) |
| 백업 30일 | 사용자 지시(2026-10-28 "권장안") |
| 사진 캐시 1일(86400초) | 제안(승인 필요) |
| 재시도 주기 10분 | 실측(jobs.ts:105) |
| 키 형식 AES-256-GCM | 실측(crypto-box.ts:14) |

## 13. 권한 범위
| 누가 | 무엇을 | 범위 |
|---|---|---|
| Claude | 코드·시뮬레이션 서버·사본 DB | 바로 |
| Claude | 운영 반영·RETAIN_SECRET 등록·첫 백업 삭제·운영 켜기 | 각각 사용자 승인(1절) |
| 운영자 | 보관 DB 열람 | 없음(읽는 화면 없음) |

## 14. 실패·원복표 / 운영 요건·막힘 대응표
| 막힘 | 자동 대처 | 중단·알림 | 사용자 행동 |
|---|---|---|---|
| RETAIN_SECRET 없음 | retainUser가 시작 전에 멈추고 stage를 RETAIN_PENDING으로 둔다. 탈퇴 자체는 1단계까지 됨 | 서버 로그 `[withdraw] RETAIN_SECRET 없음`, 정기 작업마다 반복 | 비밀값 등록 |
| 보관 DB 디스크 오류 | 운영 DB는 건드리지 않음(④ 전에 멈춤) | 로그 | 디스크 확인 |
| RETAIN_PENDING 창(상대 화면에 원래 값) | 같은 요청에서 바로 이동, 실패 시 10분 안 재시도 | — | 없음 |
| 트리거가 정상 기능을 막음 | 해당 API 500 | 로그 USER_INACTIVE | 0019_down.sql 실행(승인) |
| 파일 unlink 실패 | 다음 실행 재시도 | 로그 | 없음 |
- 긴급 정지: `WITHDRAW_ENABLED`를 끈다(K8). 이미 옮긴 데이터는 그대로 남는다.

## 15. 선행 시험·범위 동결
- 선행 시험: 1단계 시험 서버 실행(어제 135/0)이 지금 코드의 출발점이다. 2단계는 실제 외부 데이터를 쓰지 않는다(법령 문장만 공식 확인).
- 범위 동결: 0절 "빼는 것"은 개발 중 넣지 않고 발견 목록에 적는다.

## 16. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 |
|---|---|---|---|
| 0019_down 실행 | withdrawals 줄(보관 이동 진행 상태) | retained.db와 보관 폴더는 남는다 | 다시 0019를 올리면 RETAIN_PENDING 줄이 없어 재시도가 안 되므로, 롤백 전 RETAIN_PENDING 0건을 확인한다 |
| 코드만 1단계로 되돌림 | 없음 | 보관분이 파기되지 않고 쌓임 | 2단계 다시 반영 시 파기 작업이 밀린 것부터 처리 |
| 운영에서 탈퇴 실행 뒤 | 운영 DB에서 비운 값(보관 DB에만 있음) | 되돌릴 수 없음 | 그래서 운영 켜기는 별도 승인 |

## 17. 예상 지적
- 2절 RETAIN_PENDING 창 동안 노출: 받아들인 이유와 최대 10분 한도를 적었다.
- cancel_reason 작성자 구분 없음: 양쪽 탈퇴 모두 옮기는 쪽으로 정했다(과잉 보관 아님, 어차피 5년 대상).
- 트리거 13개 표가 실제 쓰기 호출 전부를 덮는지: 8절 대조표와 Grep 실측 목록(이 계획 작성 때 117줄)으로 확인한다.
- secure_delete가 과거 백업 파일까지 지우지는 않음: 백업은 30일 정리로만 사라진다(4절). 파기 뒤 최대 30일은 백업에 남는다.

## 확인하지 않은 것
- 운영 서버의 실제 백업 개수·크기(2026-10-26 기록: 10개). 운영 반영 직전에 읽기 전용으로 다시 센다.
- app/.env 실제 값(비밀 파일, 읽기 막힘).
