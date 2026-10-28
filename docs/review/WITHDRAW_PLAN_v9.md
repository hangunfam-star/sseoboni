프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261028-1147 · 작성 일시: 2026-10-28 11:47:13 KST
기준 지시: 2026-10-28 사용자 "탈퇴 입구 유지하고 2단계 진행" + "권장안"(L1 법정 보관 적용·운영 켜기 전 법률 검토, 백업 30일) · 버전: v9(탈퇴 2단계 계획, 자체 적대 검토 막는 문제 3건·참고 9건 반영) (이전 v8(탈퇴 2단계 계획 초판)) · 이전 버전과 같은지: 일부 다름
일의 크기: 대 — 운영 DB 구조 변경(트리거·표 추가), 탈퇴 때 거래 기록 이동·파기, 운영 서버 백업 삭제

# 탈퇴 2단계 계획 v9

## 00. 자체 적대 검토(SELF_REVIEW_WITHDRAW_PLAN_v9.md) 반영
| 지적 | 처리(아래 본문에 반영) |
|---|---|
| 막는 1 보관값 덮어쓰기(REPLACE) | 보관 키 = (탈퇴자 id·원천 표·원천 id·칸), `INSERT OR IGNORE`, 빈 값은 옮기지 않는다. 두 번째 당사자 탈퇴나 재실행 때 기존 보관값을 바꾸지 않는다(2절) |
| 막는 2 요청 경로와 정기 작업이 동시에 실행 | 동기 트랜잭션 하나에서 stage를 RETAINING으로 바꾸고(처리 중 표시, 5분 기한) ① 읽기까지 한다. 바뀐 줄이 1이 아니면 돌아간다(2절) |
| 막는 3 원본 사진이 없으면 영구 정지 | 파일이 없으면 보관 DB에 `missing=1`로 적고 다음 단계로 간다(2절) |
| 참고 1 상품 내용 UPDATE 경쟁 | listings·listing_trial_terms UPDATE 트리거: 판매자 withdrawals.stage가 RETAINED면 비운 값으로 가는 갱신만 통과. listing_components INSERT는 판매자 ACTIVE만(5절) |
| 참고 2 스위치를 끄면 파기도 멈춤 | 스위치는 새 탈퇴만 막는다. 이미 탈퇴한 사용자의 보관 이동·파기는 스위치와 상관없이 돈다(K8 변경) |
| 참고 3 거래 기록 취소 사유 | order_events.data의 `reason`(orders.ts:389·394)을 2호로 옮긴다. "운송장 키"는 실제로 없어 뺐다 |
| 참고 3-2(이번 판에서 추가 확인) SYSTEM 채팅에 메모 원문 | 받을 때 확인 메모(orders.ts:80)와 판매자 검수 메모(orders.ts:365)가 SYSTEM 메시지 본문에 들어간다. 탈퇴자 메모가 든 SYSTEM 메시지는 원문을 보관하고 그 부분만 "(탈퇴한 사용자의 메모)"로 바꾼다 |
| 참고 4 listing_components.name | 구성품 이름(예: "충전기")이라 개인정보로 보지 않고 유지(3절에 줄 추가) |
| 참고 5 가명 매핑 불가 | CHAT_REPORT.reportedUserId·LOGIN_LINK_ISSUED.userId는 새 무작위 `wd_` 값으로 바꾼다(원래 id와 연결 저장 안 함) |
| 참고 6 notify.ts 수정은 이미 있음 | 확인: notify.ts:41-43이 ACTIVE 아닌 받는 사람을 건너뛴다. 파일 표에서 뺐다 |
| 참고 7 시험 약함 | T17을 T17a~e로 나누고, T23 경계·T28 상대방 정상 동작 회귀를 더했다. 트리거 표 수를 실제 개수로 고쳤다 |
| 참고 8 백업 0개·키 분실 | 30일 지난 백업이라도 최신 3개는 남긴다(제안, 승인 필요). RETAIN_SECRET은 서버 .env와 사용자 보관 사본 2곳(사용자 행동) |
| 참고 9 사진 캐시 승인 누락 | 1절 승인 목록에 넣었다 |
| 미룬 항목 | 쓰기 호출 목록을 파일로 저장(docs/review/survey/withdraw2_write_calls.txt, 121줄). 운영 백업 개수를 지금 셌다(2026-10-28 11:4x 읽기 전용 ssh: 12개). 시험 파일 이름 확정(ops/e2e/unit/withdraw2_unit.sh) |

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
  - 첫 백업 정리 실행 때 30일 넘은 백업 삭제(② 영구 삭제, 최신 3개는 남김)
  - 운영에서 WITHDRAW_ENABLED=1로 켜기(L1 법률 검토 뒤, ③)
  - 정책 값 2개(제안): 사진 캐시 1일, 백업 최소 3개 유지 — 3단계(사용자 확정)에서 함께 확정
- 되돌리기
  - 코드는 이전 커밋으로 되돌린다.
  - 0019는 `app/drizzle/rollback/0019_down.sql`로 트리거·표를 지운다.
  - 실제 탈퇴로 옮기거나 지운 데이터는 되돌릴 수 없다. 그래서 운영에서는 꺼 둔 채 반영하고, 시뮬레이션 서버에서 끝까지 시험한다.

## 2. 처리 방식 — 보관 이동 상태기계 (Codex 의견: 두 DB 사이 서버 종료 복구)
| 상태(withdrawals.stage) | 언제 | 다음으로 가는 조건 |
|---|---|---|
| (없음) → RETAIN_PENDING | 1단계 탈퇴 트랜잭션 안에서 withdrawals 줄을 같이 쓴다 | 커밋 직후 같은 요청에서 retainUser 실행 |
| RETAIN_PENDING → RETAINING | retainUser ⓪: 운영 DB 동기 트랜잭션 하나에서 `UPDATE withdrawals SET stage='RETAINING', lease_until=지금+5분 WHERE user_id=? AND (stage='RETAIN_PENDING' OR (stage='RETAINING' AND lease_until<지금))`. 바뀐 줄이 1이 아니면 다른 실행이 처리 중이라 돌아간다. 같은 트랜잭션에서 ① 대상 값을 읽는다 | 바뀐 줄 1 |
| RETAINING → RETAINED | ② 보관 DB에 `INSERT OR IGNORE`(키 = 탈퇴자 id·원천 표·원천 id·칸). 빈 값(null·"")은 옮기지 않는다. 이미 있는 보관값은 바꾸지 않는다 ③ 사진 파일을 보관 폴더로 복사·fsync, 보관 DB에 파일 줄 기록(원본이 없으면 `missing=1`로 적고 넘어감) ④ 운영 DB 한 트랜잭션에서 원래 칸 비우기·사진 줄 삭제·`stage='RETAINED' WHERE stage='RETAINING'` ⑤ 원본 사진 파일 unlink | ②~④ 성공 |
| 실패·서버 종료 | 어느 단계든 중간에 멈춤 | 정기 작업(10분마다, jobs.ts:105)이 RETAIN_PENDING과 기한 지난 RETAINING을 찾아 다시 실행한다. ②는 IGNORE라 보관값이 바뀌지 않고, ④는 stage 조건이 있어 한 번만 적용된다 |
| 원본 파일 unlink 실패 | ⑤ | 보관 DB 파일 줄에 `src_removed=0`을 남기고 정기 작업이 다시 지운다(Codex 의견: unlink 실패 무시 금지) |
| 두 번째 당사자 탈퇴 | 같은 주문의 상대도 나중에 탈퇴 | 키에 탈퇴자 id가 있어 따로 보관된다. 이미 비운 칸은 빈 값이라 옮기지 않으므로 앞 보관값을 덮지 않는다 |
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
| order_events.data(287) CANCELLED의 reason(orders.ts:389·394, 자유 입력) | 2호 | 탈퇴자가 쓴 취소 이벤트(actor_id=탈퇴자)의 reason만 옮기고 지움. actor_id는 익명화된 users를 가리켜 그대로 | 같음 |
| chat_messages.body SYSTEM 종류 중 탈퇴자 메모가 든 것(orders.ts:80 받을 때 확인 메모, orders.ts:365 판매자 검수 메모) | 3호 | 원문을 보관하고 본문의 메모 부분만 "(탈퇴한 사용자의 메모)"로 바꿈 | 같음 |
| listing_components.name(86) | 유지 | 구성품 이름이라 개인정보로 보지 않음 | — |
| disputes.detail(297) | 4호(분쟁) | 개설자가 탈퇴하면 옮기고 null. resolution은 운영자 글이라 유지 | 분쟁 정리일(없으면 탈퇴일) |
| chat_messages.body(156) USER 종류, 주문이 있었던 방 | 2호 | 옮기고 원래 본문 "(탈퇴한 사용자의 메시지)" | 그 방 주문이 끝난 날 |
| chat_messages.body USER 종류, 주문 없는 방 | 보존 근거 없음 | 탈퇴 트랜잭션에서 바로 "(탈퇴한 사용자의 메시지)"(보관 안 함) | — |
| reviews.body(315), trial_reviews.answers·reason·learned·fit_for(329-332) | 익명화 후 유지 | 탈퇴 때 findContactInfo(app/src/ui/trial-pricing.ts:127)로 검사, 걸린 칸만 null | — |
| market_validation_events.metadata(194) FEEDBACK.message | 보존 근거 없음 | 탈퇴자 것은 탈퇴 때 비움 | — |
| metadata CHAT_REPORT.reportedUserId, LOGIN_LINK_ISSUED.userId | 익명화 | 탈퇴 때 새 무작위 `wd_` 값으로 바꿈(원래 id와 연결해 저장하지 않음) | — |
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
  - 백업 방식은 better-sqlite3 `.backup()`이다(WAL 내용까지 일관된 사본, ops/deploy.sh:20).
  - 2단계에서는 같은 자리에 retained.db 백업을 더한다.
  - `ops/backup_prune.sh`로 30일 넘은 백업을 지우되, 종류별 최신 3개는 남긴다. 배포가 30일 넘게 없어도 백업이 0개가 되지 않게 하려는 것이다.
  - 2026-10-28 운영 서버 백업은 12개다(읽기 전용 확인).
- RETAIN_SECRET을 잃으면 보관분을 읽을 수 없다(파기는 키 없이 가능). 서버 .env에 두고, 사용자가 따로 안전한 곳에 사본을 보관한다(사용자 행동).

## 5. 쓰기 장벽 (0019 트리거) — Codex 의견 3·Claude 검토 2 반영
- 사용자 칸 표: BEFORE INSERT 트리거를 둔다. 그 줄의 사용자가 ACTIVE가 아니면 `RAISE(ABORT,'USER_INACTIVE')`로 거절한다. 대상은 아래 17개 표다(schema에 모두 있음, Claude 검토 2). 그 밖에 listings·listing_photos·listing_trial_terms·listing_components·market_validation_events·users 6개 표에 따로 규칙을 둔다.
- 탈퇴자를 상대로 하는 정상 동작은 막히지 않는다(자체 적대 검토 확인).
  - 알림은 notify.ts:41-43이 먼저 건너뛴다.
  - 경험치·SYSTEM 채팅은 진행 중 거래에서만 생기는데, 탈퇴자는 blockersOf 때문에 진행 중 거래가 없다.
  - SYSTEM 메시지는 kind 조건으로 통과한다.
  - wishlists.user_id, demand_intents.user_id, seller_accounts.user_id, push_subscriptions.user_id, notification_prefs.user_id
  - notifications.user_id, login_links.user_id, social_accounts.user_id
  - chat_messages.sender_id(kind='USER'만), chat_threads.buyer_id·seller_id, trial_proposals.buyer_id, orders.buyer_id·seller_id
  - order_photos.user_id, disputes.opener_id, reviews.writer_id, trial_reviews.writer_id, xp_awards.user_id
- market_validation_events.user_id: 'wd_'로 시작하는 가명과 null은 통과시킨다.
- listings
  - INSERT: seller가 ACTIVE가 아니면 거절한다.
  - UPDATE: seller가 WITHDRAWN이고 NEW.status가 ACTIVE·HIDDEN·RESERVED 중 하나면 거절한다. REMOVED·SOLD로 내용만 비우는 갱신은 통과한다. v4(탈퇴 전체 설계 초안)는 SOLD 상품 비우기까지 막았는데, 이 판에서 고쳤다(Codex 의견 3).
  - UPDATE 추가 규칙: 판매자의 withdrawals.stage가 RETAINED이면 title이 "탈퇴한 판매자의 상품"이고 description이 "", check_items가 null인 갱신만 통과한다. 보관 이동이 끝난 뒤 수정 요청이 늦게 도착해 원래 내용이 다시 써지는 경쟁을 막는다.
- listing_photos·listing_components INSERT: 그 상품의 seller가 ACTIVE가 아니면 거절한다.
- listing_trial_terms
  - INSERT: 그 상품의 seller가 ACTIVE가 아니면 거절한다.
  - UPDATE: seller가 ACTIVE가 아니면 condition_note를 null로 바꾸는 갱신만 통과한다.
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
| app/src/app/withdrawn/page.tsx, me/account/WithdrawForm.tsx | 수정 | 안내 문구: "거래 기록은 법에 따라 따로 보관했다가 기간이 지나면 지워요" |
| ops/backup_prune.sh, ops/deploy.sh | 신규·수정 | 30일 정리, retained.db 백업 |
| ops/e2e/suites/test_withdraw.py, ops/e2e/unit/withdraw2_unit.sh | 수정·신규 | 9절 시험 |

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
| T17a~c | retainUser를 ①·②·③ 뒤에서 각각 멈춘 뒤(단위 시험에서 단계 함수를 바꿔 끼움) 정기 작업 1회 | stage가 RETAINED가 아니거나, 보관 줄이 중복·누락되거나, 보관값이 빈 값 | K3 |
| T17d | 같은 사용자에 retainUser 두 개를 동시에 시작 | 둘 다 ②에 들어감(처리 중 표시 무시) | K3 |
| T17e | 같은 주문의 구매자 탈퇴 → 판매자 탈퇴 | 첫 보관값(cancel_reason 등)이 바뀌거나 사라짐 | K3 |
| T17f | 원본 사진 파일을 미리 지운 뒤 탈퇴 | stage가 RETAINED로 가지 않음 | K3 |
| T18 | 탈퇴 뒤 트리거: 탈퇴자 id로 17개 표 + listing_photos·listing_components·listing_trial_terms·listings에 직접 INSERT | 1건이라도 성공 | K4 |
| T18b | stage=RETAINED 뒤 상품 제목을 원래 값으로 UPDATE | 성공함 | K4 |
| T19 | 탈퇴자 SOLD 상품 내용 비우기, REMOVED 유지 갱신 | 트리거가 막음 | K4 |
| T20 | 탈퇴 뒤 users 이름 되돌리기 UPDATE | 성공함 | K4 |
| T21 | 탈퇴 판매자 상품 사진 주소 | 200 | K5 |
| T22 | 상대방 주문 화면·상품 목록(PC 1280·모바일 375 스크린샷) | 화면 오류·깨진 이미지 아이콘 | K5 |
| T23 | 시계를 각 기한 −1일·+1일로(nowMs 인자) 파기. 분쟁 있는 주문 사진은 3년+1일에 남고 5년+1일에 지워짐 | 기한 전에 지워지거나 기한 뒤 남음, 긴 쪽 규칙 어김 | K6 |
| T24 | 파기 뒤 retained.db·dev.db·-wal 파일 바이트에서 시험 표식 문자열 검색(백업 폴더는 30일 정리 대상이라 T25로 따로 본다) | 표식 발견 | K6 |
| T25 | backup_prune.sh를 가짜 폴더(31일 5개·29일 1개)로 실행 | 29일 파일 삭제, 최신 3개보다 적게 남음, 31일 파일 중 최신 3개 밖의 것이 남음 | K7 |
| T26 | 주문 없는 방 채팅·후기 연락처·FEEDBACK 메시지·SYSTEM 채팅 속 메모·취소 사유 | 원래 글 남음 | K1 |
| T27 | WITHDRAW_ENABLED를 끈 상태에서 이미 탈퇴한 사용자의 RETAIN_PENDING 처리와 파기 | 꺼졌다고 처리·파기가 멈춤, 또는 새 탈퇴 POST가 503이 아님 | K8 |
| T28 | 탈퇴자를 상대로 하는 정상 동작: 상대가 후기 쓰기, reviewReminders 실행, 탈퇴자 상품이 있던 목록 보기 | 오류(500)·화면 깨짐 | K4·K5 |
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
| K8 | 스위치는 새 탈퇴만 막고, 이미 탈퇴한 사용자의 보관 이동·파기는 계속됨(법정 파기 기한 지킴) |

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
| 백업 최소 3개 유지 | 제안(승인 필요) |
| 처리 중 표시 5분 | 제안(승인 필요) |
| 운영 백업 12개 | 실측(2026-10-28 ssh 읽기 전용) |
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
| 원본 사진 파일 없음 | `missing=1` 기록 후 진행 | 로그 | 없음 |
| 보관 이동 처리 중 서버 종료 | 처리 중 표시 5분 뒤 다른 실행이 이어받음 | 로그 | 없음 |
- 긴급 정지: `WITHDRAW_ENABLED`를 끄면 새 탈퇴가 멈춘다(K8). 이미 옮긴 데이터는 그대로 남고, 보관 이동·파기는 계속된다.

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
- 트리거가 실제 쓰기 호출 전부를 덮는지: 쓰기 호출 목록 docs/review/survey/withdraw2_write_calls.txt(121줄, 2026-10-28 실측)의 표 이름이 5절 대상(17개 + 규칙 6개)이나 개인정보 없는 표(categories·product_models·carry_nonces·order_events·buyer/seller_profiles)에 모두 들어가는지 개발 첫 단계 시험 T18이 표 목록을 이 파일에서 읽어 확인한다.
- secure_delete가 과거 백업 파일까지 지우지는 않음: 백업은 30일 정리로만 사라진다(4절). 파기 뒤 최대 30일은 백업에 남는다.

## 확인하지 않은 것
- app/.env 실제 값(비밀 파일, 읽기 막힘).
- 당근 가져오기 시험 사진(scripts/import-daangn.cjs)이 사진 차단 뒤에도 보이는지 — listing_photos 줄로 저장하므로 영향 없을 것으로 보지만 T28 목록 화면에서 함께 확인한다.
