프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261026-1903 · 작성 일시: 2026-10-26 19:03:03 KST
기준 지시: 2026-10-26 규칙 총괄 세션 전달 "탈퇴 기능은 써보니 세션에서 개발" + 정책 Q1~Q7 권장안에 사용자 "진행" · 버전: v1(탈퇴 기능 개발 계획) · 이전 버전과 같은지: 처음
일의 크기: 대 — 운영 DB 표 구조 변경·개인정보 삭제·운영 반영 포함

# 탈퇴 기능 개발 계획

참조 규칙: PLANNING_RULES_v3.md, 38절(기획 규칙 6단계), 41절(기획 규칙 v3 보강), 42절(계획서 관문), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만).

## 1. 완성 지도
- 완성 정의
  - 로그인한 사용자가 MY → 정산 계좌 화면(`/me/account`) 맨 아래 "탈퇴하기"로 탈퇴한다.
  - 탈퇴하면 바로 로그아웃되고, 다시 로그인할 수 없다.
  - 다른 사람 화면에는 "탈퇴한 사용자"만 보인다.
  - 거래 기록은 법정 기간 동안 분리 보관한 뒤 자동으로 지운다.
- 현재 위치: 탈퇴 기능 없음. 부분 기능 3개만 있다(로그아웃, 카카오 연결 해제, 정산 계좌 삭제).
- 남은 개발 전체(순서)
  1. DB 이전
  2. 탈퇴 처리 함수
  3. API
  4. 화면
  5. 보관 기록 자동 파기 작업
  6. 시험
  7. Codex 검수
  8. 운영 반영(승인)
- 필요한 승인
  - 운영 반영 1회: 운영 DB에 표 추가, 되돌리기 쉬움. 83절(승인은 4가지만) ③에 해당한다.
  - 카카오 어드민 키 등록: 83절 ④(비밀 키)에 해당한다. 사용자가 직접 넣는다.
- 되돌리기
  - 코드: 이전 커밋으로 되돌린다.
  - DB: 새 표만 추가하고 기존 칸은 지우지 않는다. 그래서 새 표를 그대로 두어도 이전 코드가 동작한다.
  - 실제 사용자가 탈퇴하며 지운 데이터는 되돌릴 수 없다. 그래서 운영 반영 전에 TEST에서 끝까지 확인한다.

## 2. 확정된 정책 (사용자 "진행" = 권장안 채택)
| # | 정책 | 결정 |
|---|---|---|
| Q1 | 진행 중 거래 | 끝나지 않은 주문(FINAL_STATUSES 밖)이나 OPEN 분쟁이 하나라도 있으면 탈퇴를 막고 거래 목록을 보여 준다 |
| Q2 | 올린 상품 | 모두 REMOVED로 바꾼다. 거래가 없는 상품은 사진 파일을 지운다. 거래가 있는 상품은 주문 스냅샷으로 기록이 남는다 |
| Q3 | 채팅 | 메시지는 남긴다. 이름은 "탈퇴한 사용자"로, 사진은 없음으로 바꾼다 |
| Q4 | 정산 계좌·프로필 사진·찜·찾는 상품·알림·푸시·알림 설정·로그인 링크 | 바로 지운다 |
| Q5 | 재가입 | social_accounts 연결을 지우므로, 같은 카카오로 로그인하면 새 계정이 된다(이전 기록과 이어지지 않음) |
| Q6 | 거래 기록 개인정보(배송지·환불 계좌·입금자명·신청 시 판매자 계좌) | 주문 행에서 지우고 `retained_records`(분리 보관 표)로 옮긴다. 5년 뒤 자동 파기 |
| Q7 | 카카오 쪽 연결 끊기 | 환경변수 `KAKAO_ADMIN_KEY`가 있으면 공식 API로 끊는다. 없으면 써보니 쪽 연결만 지우고, 끊기 결과에 "SKIPPED_NO_KEY"를 기록한다. 운영 서버에는 지금 이 키가 없다(2026-10-26 서버 컨테이너 환경변수 이름 실측: KAKAO_CLIENT_SECRET, KAKAO_REST_KEY만 있음) |

## 3. 파일
| 파일 | 상태 | 역할 |
|---|---|---|
| app/drizzle/0018_withdraw.sql | 신규 | `users.withdrawn_at` 칸, `withdrawals` 표(사용자 id·시각·카카오 끊기 결과), `retained_records` 표(주문 id·종류·암호문·파기 예정일) 추가 |
| app/src/db/schema.ts | 수정 | 위 표와 칸을 정의한다 |
| app/src/lib/withdraw.ts | 신규 | `blockersOf(userId)`, `withdrawUser(userId)`(트랜잭션 하나), `purgeRetained(now)` |
| app/src/lib/kakao.ts | 수정 | `unlinkKakaoRemote(kakaoId)` 추가. 어드민 키 방식, 시간 제한 10초. 실패해도 탈퇴는 진행하고 결과만 기록한다 |
| app/src/app/api/me/withdraw/route.ts | 신규 | GET은 막는 거래 목록, POST는 탈퇴 실행. 확인 문구 "탈퇴합니다"가 있어야 실행한다 |
| app/src/app/me/account/WithdrawForm.tsx | 신규 | 탈퇴 안내(지워지는 것·남는 것·되돌릴 수 없음), 막는 거래 목록, 확인 입력 |
| app/src/app/me/account/page.tsx | 수정 | 맨 아래에 WithdrawForm을 붙인다 |
| app/src/lib/jobs.ts | 수정 | `runJobs`에 `purgeRetained`를 추가한다 |
| ops/e2e/suites/test_withdraw.py | 신규 | 실제 브라우저 시험(PC 1280·모바일 375) |

## 4. 표별 처리 (users.id 참조 칸 22개 + 참조 표시가 없는 칸 3개)
| 표.칸 | 처리 |
|---|---|
| users | 남김. status=WITHDRAWN, nickname="탈퇴한 사용자", kakao_image_url=null, show_photo=0, withdrawn_at=지금 |
| seller_profiles.user_id / buyer_profiles.user_id | 남김(평판 숫자만 있음) |
| listings.seller_id | 남김. status=REMOVED. 거래가 없는 상품은 listing_photos 줄과 파일을 지운다 |
| trial_proposals.buyer_id | 남김. PENDING이면 CANCELLED로 바꾼다 |
| chat_threads.buyer_id·seller_id / chat_messages.sender_id | 남김(Q3). 이름은 users 쪽 익명화로 바뀐다 |
| demand_intents.user_id | 지움 |
| seller_accounts.user_id | 지움 |
| orders.buyer_id·seller_id | 남김. 내 쪽 개인정보 칸(구매자면 ship_enc·refund_enc·deposit_name, 판매자면 seller_account_enc)을 retained_records로 옮긴 뒤, 비우거나 "탈퇴" 표시로 바꾼다 |
| order_photos.user_id | 남김(분쟁 증거). retained_records에 파기 예정일을 적고, 3년 뒤 파일과 줄을 지운다 |
| disputes.opener_id | 남김(분쟁 기록 3년) |
| reviews.writer_id·target_id / trial_reviews.writer_id | 남김(이름만 익명화) |
| xp_awards.user_id | 남김 |
| social_accounts.user_id | 지움(+카카오 쪽 끊기 시도, Q7) |
| login_links.user_id | 지움 |
| notifications.user_id | 지움 |
| push_subscriptions.user_id | 지움 |
| notification_prefs.user_id | 지움 |
| wishlists.user_id(참조 표시 없음) | 지움 |
| market_validation_events.user_id(참조 표시 없음) | user_id를 null로 바꾼다(통계는 남김) |
| order_events.actor_id(참조 표시 없음) | 남김(거래 기록) |

## 5. 설계–코드 대조표
| 설계 문장 | 호출 함수(파일:행) | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴하면 바로 로그인 불가 | app/src/lib/session.ts:53 `getCurrentUserId`가 status≠ACTIVE면 null을 돌려준다(기존 동작 재사용) | users | 없음 | 충돌 없음 |
| 탈퇴 시 쿠키 지움 | app/src/app/api/session/route.ts:58 `DELETE`의 clearSessionCookie와 같은 처리 | 없음 | 없음 | 충돌 없음 |
| 진행 중 거래 판정 | app/src/ui/trade-rules.ts:14 `FINAL_STATUSES` 재사용 | orders, disputes | 없음 | 충돌 없음 |
| 재가입은 새 계정 | app/src/lib/kakao.ts:126 `userOfKakao`가 social_accounts가 없으면 null → 가입 흐름 | social_accounts | users(새 줄) | 충돌 없음 |
| 써보니 쪽 카카오 연결 지움 | app/src/lib/kakao.ts:152 `unlinkKakao` 재사용 | social_accounts | social_accounts | 충돌 없음 |
| 카카오 쪽 연결 끊기 | 신규 `unlinkKakaoRemote`(lib/kakao.ts에 추가, 어드민 키 방식) | social_accounts | withdrawals | 충돌 없음 |
| 채팅·후기 이름 익명화 | app/src/lib/chat.ts:50, app/src/lib/reviews.ts:105가 users.nickname을 읽으므로 users 한 줄만 바꾸면 반영된다 | users | users | 충돌 없음 |
| 상품 사진 파일 삭제 | app/src/lib/photos.ts:83 `deletePhoto` 재사용 | listing_photos | listing_photos | 충돌 없음 |
| 탈퇴 처리 한 번에 | 신규 `withdrawUser`(lib/withdraw.ts, db.transaction 하나) | 4절의 표 | 4절 표대로 | 충돌 없음 |
| 보관 기록 자동 파기 | app/src/lib/jobs.ts:85 `runJobs`에 신규 `purgeRetained` 추가 | retained_records | retained_records, order_photos | 충돌 없음 |
| 탈퇴 화면 | app/src/app/me/account/page.tsx:15 `AccountPage`에 신규 WithdrawForm을 붙인다 | users, orders | 없음 | 충돌 없음 |
| 통계 기록은 남김 | 신규 `withdrawUser` 안에서 market_validation_events.user_id를 null로 바꾼다 | market_validation_events | market_validation_events | 충돌 후 해소: 관리자 지표가 user_id로 사람 수를 세면 숫자가 줄 수 있다. 개발 때 app/src/lib/admin-metrics.ts를 읽고, 줄어들면 "탈퇴 n명" 줄을 따로 보인다 |

## 6. 외부 서비스 근거표
| 항목 | 공식 문서 주소 | 확인한 문장 | 확인일 | 상태 |
|---|---|---|---|---|
| 거래기록 보존 기간 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 계약 또는 청약철회 등에 관한 기록: 5년 / 대금결제 및 재화등의 공급에 관한 기록: 5년 / 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 | 2026-10-26 | 확인 |
| 동의 철회 소비자 기록 분리 | https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령/제6조 | 개인정보의 이용에 관한 동의를 철회한 소비자의 거래기록 및 개인정보를 보존하는 경우에는 … 별도로 보존할 것 | 2026-10-26 | 확인 |
| 개인정보 파기·분리 보관 | https://www.law.go.kr/법령/개인정보보호법/제21조 | 다른 법령에 따라 보존하여야 하는 경우에는 … 다른 개인정보와 분리하여서 저장ㆍ관리하여야 한다 | 2026-10-26 | 확인 |
| 카카오 연결 끊기 API | https://developers.kakao.com/docs/ko/kakaologin/rest-api | POST https://kapi.kakao.com/v1/user/unlink, Authorization: KakaoAK ${SERVICE_APP_ADMIN_KEY}, target_id_type=user_id, target_id | 2026-10-26 | 확인 |
| 써보니가 통신판매중개자에 해당하는지 | 해당 공식 해석 문서를 찾지 못함 | 판정 문장 없음 | 2026-10-26 | 미확인 — 개발 범위 제외. 보관 의무가 있다고 가정하고 5년·3년으로 정한다(Q6) |

## 7. 값 출처표
| 값 | 출처구분 | 근거 |
|---|---|---|
| 거래 개인정보 보관 5년 | 공식 문서 | 전자상거래법 시행령 제6조 제1항 제2·3호 |
| 분쟁 증거 사진 보관 3년 | 공식 문서 | 같은 조 제1항 제4호 |
| 카카오 끊기 시간 제한 10초 | 제안(승인 필요) | 탈퇴 화면이 오래 멈추지 않게 하려고 |
| 확인 문구 "탈퇴합니다" | 제안(승인 필요) | 실수로 누르는 것을 막으려고 |
| 1분에 3번 넘게 요청하면 429 | 제안(승인 필요) | 반복 요청 방지 |

## 8. 권한 범위
| 누가 | 할 수 있는 것 |
|---|---|
| 본인(로그인) | 자기 계정만 탈퇴한다. 요청에서 다른 사람 id는 받지 않고 세션의 userId만 쓴다 |
| 다른 사용자 | 없음 |
| 운영자 | 이번 범위에는 강제 탈퇴가 없다. 관리자 화면에 탈퇴 수만 보인다 |

## 9. 실패·원복표
| 실패 | 처리 |
|---|---|
| 트랜잭션 중간 오류 | 전부 롤백한다. 탈퇴 안 됨, 오류 문구 표시 |
| 사진 파일 삭제 실패 | DB 처리는 끝낸다. 파일 이름을 로그에 남기고 다음 파기 작업에서 다시 지운다 |
| 카카오 끊기 실패·키 없음 | 탈퇴는 완료한다. withdrawals.kakao_unlink에 결과를 기록한다 |
| 진행 중 거래 있음 | 409와 막는 거래 목록을 돌려준다 |
| 두 번 누름 | 이미 WITHDRAWN이면 성공으로 돌려준다(쿠키만 지움) |

## 10. 값 제한 점검
- 확인 문구가 정확히 일치해야 실행한다.
- 요청 본문에 사용자 id를 받지 않는다.
- 같은 사용자가 1분에 3번을 넘게 요청하면 429를 돌려준다.

## 11. 동작 특성과 시험 방법
- 시험은 운영 복사 DB와 가짜 카카오 서버에서 한다. 시험 전 스냅숏을 만들고, 끝나면 원복해 차이 0을 확인한다(25절(기능 검수는 실제 실행)).
- 사례
  1. 거래 없는 사용자 탈퇴 → 로그인 불가, 다른 사람의 채팅·후기 화면에 "탈퇴한 사용자"(실제 브라우저)
  2. 진행 중 거래가 있으면 막힘(409와 목록)
  3. 판매자 탈퇴 → 상품 REMOVED, 사진 파일 삭제
  4. 끝난 거래가 있는 구매자 탈퇴 → orders.ship_enc가 비고 retained_records에 1줄
  5. 같은 카카오로 다시 로그인 → 새 계정(id가 다름)
  6. 파기 작업에 시각을 5년 1일 뒤로 넣으면 retained_records가 지워짐
  7. 일부러 틀린 입력: 확인 문구가 틀리면 400, 남의 id를 넣어도 무시
- 화면 시험: PC 1280px, 모바일 375px(UA·터치 흉내)
- 보고는 84절(통과 보고에 입력 규모·확인한 것·실패 가능 증거) 기준으로 한다. 사례마다 일부러 틀린 입력으로 실패하는 것도 함께 본다.

## 12. 회귀
- 기존 e2e 묶음(test_checks.py, test_checks_fix.py, legacy/trade_e2e.py)을 다시 돌린다.
- 로그아웃·카카오 연결 해제·정산 계좌 삭제가 그대로 동작하는지 확인한다.

## 13. 합격 기준
| 기준 | 판정 방법 |
|---|---|
| 탈퇴 후 로그인 불가 | 쿠키를 다시 써도 /api/session이 비로그인 |
| 다른 사람 화면에 개인 정보 없음 | 상대 계정의 채팅·후기·주문 화면 글자에서 원래 닉네임·주소가 0건 |
| 진행 중 거래 규칙 | 사례 2 |
| 분리 보관·자동 파기 | 사례 4·6 |
| 실제 브라우저 PC·모바일 | 스크린샷 경로 |
| 시험 데이터 원복 | 스냅숏 비교 차이 0 |

## 14. 운영 요건·권한·막힘 대응표
| 항목 | 내용 |
|---|---|
| 필요 권한 | 운영 반영 1회 승인(83절 ③), 카카오 어드민 키(83절 ④, 사용자가 직접 넣음) |
| 항상 사람이 할 일 | 키 등록 |
| 막힘 → 대처 | 카카오 API가 실패하면 탈퇴는 진행하고 결과를 기록한다. 관리자 화면에 실패 수를 보인다 |
| 긴급 정지 | 환경변수 `WITHDRAW_ENABLED=0`이면 API는 503, 화면 버튼은 숨김 |
| 막힘 재현 시험 | 가짜 카카오 서버가 unlink에 500을 돌려주게 하고 사례 1을 다시 돈다 |

## 15. 선행 시험·개선 경로·범위 동결
- 선행 시험: 개발 첫 단계에서 운영 복사 DB의 사용자 수와 진행 중 거래 수를 읽기 전용으로 센다.
- 개선 경로: 탈퇴 사유는 받지 않는다. 필요하면 다음 계획에 넣는다.
- 범위 동결: 운영자 강제 탈퇴, 탈퇴 사유 조사, 내 데이터 내려받기는 이번 범위에서 빼고 "발견 목록"에 둔다.

## 16. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 유지 |
|---|---|---|---|
| 코드 되돌림(이전 커밋) | 없음(새 표는 남음) | 이미 끊은 카카오 연결은 다시 붙지 않음 | 탈퇴 사용자는 status=WITHDRAWN이라 옛 코드에서도 로그인 불가 |
| 새 표 삭제(하지 않음) | withdrawals·retained_records 내용 | 이미 지운 개인정보는 복구 불가 | 이 롤백은 하지 않는다 |

## 17. 예상 지적
- 통신판매중개자 해당 여부가 미확인이다. → 의무가 있다고 가정하는 안전한 쪽으로 정했다(외부 서비스 근거표에 미확인으로 표시).
- 판매자가 탈퇴하면 구매자의 진행 중 거래는 어떻게 되나? → Q1로 막는다.
- 분리 보관 암호문의 키는? → 기존 crypto-box(app/src/lib/crypto-box.ts) 키를 쓴다. 키를 바꾸면 이전 보관분을 읽을 수 없으므로 키 교체 절차에 포함한다.
