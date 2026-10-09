# 써보니 거래·후기·등급·공유·삭제·찜 독립 검수 결과 v1.3

- 검수일: 2026-10-09 KST
- 저장소: `E:\PROJECTS\04_써보니`
- 요청 브랜치: `gate0/market-ui`
- 코드 검수 범위: `c88089c..f277925`
- 실제 확인 브랜치/HEAD: `gate0/market-ui` / `0662f05` (HEAD의 뒤쪽 커밋은 검수 요청 문서이며 제품 코드 검수는 지정 범위로 고정)
- 실행 방식: 코드·DB·서버는 백그라운드, 브라우저는 실행 환경 권한 차단
- 최종 판정: **FAIL**

## 1. 판정 요약

지정 구간에서 실제 코드 결함 6건을 확인했다. 특히 한쪽만 작성한 평가의 비공개 기간에도 판매자 신뢰 숫자가 바뀌는 노출, 분쟁 중 단계가 이동할 때 멈춘 시간을 과다 계산하는 문제, 분쟁으로 늦춘 기한과 화면 안내가 어긋나는 문제가 있다.

격리 DB와 `tradeOpen=true` 설정, 3200 포트 서버까지는 만들고 HTTP 200을 확인했다. 그러나 이 실행 환경이 브라우저 자동화에 필요한 자식 프로세스·IPC 채널 생성을 거부해 PC 1280px/모바일 375px 실제 클릭·입력 시험과 스크린샷은 전부 `BLOCKED`다. 실행하지 못한 시나리오는 PASS로 추정하지 않았다.

## 2. 코드 검수 결함

### 2.1 비공개 평가가 판매자 신뢰 숫자로 먼저 드러남

- 근거: `app/src/lib/trade-stats.ts:68-76`, `app/src/app/sellers/[id]/page.tsx:52-54`
- 실패 상황: 구매자만 평가를 남기고 판매자는 아직 평가하지 않았으며 7일도 지나지 않았다. 평가 본문은 비공개여야 하지만 공개 판매자 화면의 `설명과 실제 일치`, `구성품 안내 정확` 분자·분모가 즉시 바뀐다. 상대는 평가 작성 여부와 예/아니오 결과를 숫자로 추론할 수 있다.
- 심각도: **중간**
- 수정 방법: `sellerTrust()`의 평가 집계에도 `reviews.ts`와 같은 공개 조건(쌍방 작성 또는 거래 완료 후 `reviewRevealDays`)을 적용한다. 공개 전 평가가 신뢰 통계·별점·후기 목록 어디에도 반영되지 않는 회귀시험을 추가한다.

### 2.2 분쟁 중 단계가 이동하면 실제보다 긴 시간을 멈춘 것으로 계산함

- 근거: `app/src/ui/trade-rules.ts:156-158`, `app/src/lib/orders.ts:535-543`
- 실패 상황: 배송 중 분쟁을 연 뒤 구매자가 분쟁 중 허용된 `받았어요`를 눌러 체험이 시작되고, 이후 운영자가 분쟁을 정리한다. 코드는 분쟁 생성부터 정리까지 전 시간을 새 체험 단계의 `trialEndAt`에 더하므로, 실제 체험 단계에서 멈춘 시간보다 분쟁 전 배송 단계 시간이 더해진다. 반송 등 다른 허용 단계 이동도 같은 방식으로 현재 단계 기한을 과다 연장할 수 있다.
- 심각도: **중간**
- 수정 방법: 분쟁 시작 당시 상태와 각 상태 전환 시각을 기록하고, 각 기한 구간과 분쟁 구간의 실제 겹친 시간만 연장한다. 단순화하려면 분쟁 중에는 상태 이동도 막고 운영자 정리 뒤 재개하도록 정책과 코드를 맞춘다.

### 2.3 분쟁으로 연장된 기한이 거래 화면에 반영되지 않음

- 근거: `app/src/lib/orders.ts:363-399`, `app/src/lib/orders.ts:447-455`
- 실패 상황: 배송·받음 대기·반송·환불 단계에서 분쟁을 정리해 `waitShiftMs`가 생기면 자동 처리는 연장 시간을 사용한다. 하지만 `shipBy`, `returnShipBy`, `autoConfirmAt`, `autoReceiveAt` 화면 기한은 `waitShiftMs`를 더하지 않아 사용자에게 더 이른 잘못된 마감시각을 보여 준다.
- 심각도: **중간**
- 수정 방법: `orderView()`가 현재 단계의 `waitShiftMs`를 포함한 단일 기한 계산 함수를 사용하게 하고, 자동 처리 계산과 화면 표시가 같은 값을 쓰도록 한다.

### 2.4 별점과 반대 의미의 후기 문구를 API로 저장할 수 있음

- 근거: `app/src/lib/reviews.ts:51-55`, `app/src/ui/trade-rules.ts:215-220`
- 실패 상황: 직접 API 요청으로 별점 10점과 `설명과 달라요` 같은 낮은 점수용 문구를 함께 보내면 저장된다. 화면은 점수별 문구를 나누지만 서버는 좋은 문구·나쁜 문구의 합집합만 검사해 후기 의미를 조작할 수 있다.
- 심각도: **낮음**
- 수정 방법: 서버도 `chipsFor(direction, stars)` 결과만 허용하고, 허용되지 않은 문구가 하나라도 오면 조용히 버리지 말고 400으로 거부한다.

### 2.5 계좌 암호 해독 실패에도 빈 계좌로 거래가 만들어짐

- 근거: `app/src/lib/crypto-box.ts:20-30`, `app/src/lib/orders.ts:101-102`, `app/src/lib/orders.ts:150-152`
- 실패 상황: `SESSION_SECRET` 변경 또는 암호문 손상으로 `open(account.accountEnc)`가 `null`을 반환해도 판매자 계좌 행이 있다는 이유로 신청을 허용한다. 주문에는 빈 계좌가 다시 암호화돼 저장되고 상품은 `RESERVED`가 되지만 구매자는 송금할 계좌를 받지 못한다.
- 심각도: **높음**
- 수정 방법: 신청 트랜잭션 전에 계좌번호 복호화 결과를 검증하고 실패하면 거래를 만들지 말고 판매자에게 계좌 재등록이 필요하다는 409 오류를 반환한다. 상품 예약과 주문 삽입도 발생하지 않는 회귀시험을 추가한다.

### 2.6 예금주 이름이 암호화되지 않고 저장됨

- 근거: `app/drizzle/0009_trade.sql:103-110`, `app/src/db/schema.ts:196-202`, `app/src/app/api/seller-account/route.ts:36-38`
- 실패 상황: 계좌번호는 암호문이지만 실명일 수 있는 예금주 이름은 `seller_accounts.holder`에 평문으로 남는다. DB 파일 유출 시 계좌 개인정보의 일부가 그대로 노출된다.
- 심각도: **중간**
- 수정 방법: 계좌번호·예금주를 하나의 암호화 레코드로 저장하거나 예금주 전용 암호화 열을 추가한다. 기존 평문을 안전하게 옮기는 다음 번호 마이그레이션과 구버전 읽기 호환을 준비한다.

## 3. 보조 검증

| 항목 | 결과 | 근거 |
|---|---|---|
| 격리 DB 백업·마이그레이션 확인 | PASS | `scratchpad\trade\dev_review_v1_3.db`, `integrity_check=ok`, 기존 거래 0건 |
| 격리 설정 | PASS | `scratchpad\trade\trade-settings-review-v1.3.json`, `tradeOpen=true` |
| 격리 서버 | PASS(대체 실행) | `next dev`는 `spawn EPERM`; 같은 DB·설정의 `next start -H 127.0.0.1 -p 3200`은 Ready 및 HTTP 200 |
| TypeScript | PASS(보조) | `node node_modules\typescript\bin\tsc --noEmit`, 종료코드 0. 실행 뒤 외부 작업트리 변경이 발견돼 지정 커밋 단독 증거로 확대하지 않음 |
| UI·거래 순수 함수 시험 | PASS(보조) | 기본 `npm run test:ui`는 자식 프로세스 생성이 막혔고, 동일 5개 파일을 `--test-isolation=none`으로 실행해 43/43 PASS. 실행 뒤 외부 작업트리 변경이 발견돼 지정 커밋 단독 증거로 확대하지 않음 |
| 실제 브라우저 클릭·입력 | BLOCKED | 아래 4절의 실행 환경 오류 |

## 4. 실제 브라우저 구동 시험

### 4.1 정확한 차단 원인

1. CUA 백그라운드 브라우저: `Browser is not available: iab`.
2. 연결 Chrome 새 검수 탭: `Owl extension-created tabs must be active`가 두 방식에서 반복됨. 기존 사용자 탭은 보존하기 위해 다른 주소로 전환하지 않았다.
3. Python Playwright 1.63.0: 브라우저 드라이버 파이프 생성 중 `_winapi.CreateFile`에서 `PermissionError: [WinError 5] 액세스가 거부되었습니다`.
4. 설치된 Chrome 직접 헤드리스 실행: `platform_channel.cc:112 ... 액세스가 거부되었습니다 (0x5)`로 종료.

격리 서버 자체는 `http://127.0.0.1:3200`에서 200을 반환했다. 차단 범위는 브라우저 프로세스/탭 생성과 실제 UI 조작·스크린샷 캡처다.

### 4.2 시나리오별 결과

모든 예정 경로는 `E:\PROJECTS\04_써보니\앱화면_2026-10-08_v1.1\Codex검수_v1.3\` 아래다. 브라우저가 열리지 않아 아래 파일은 **실제로 생성되지 않았다**.

| 번호 | 시나리오 | PC 1280px | 모바일 375px | 스크린샷 경로 |
|---|---|---|---|---|
| 1 | 정산 계좌 저장·가림·삭제 확인창 | BLOCKED | BLOCKED | 미생성: `pc_01_account.png`, `m_01_account.png` |
| 2 | 써보기 등록·신청·질문 3개·입금 대기·계좌 복사 | BLOCKED | BLOCKED | 미생성: `pc_02_order_await.png`, `m_02_order_await.png` |
| 3 | 입금 전 배송지 숨김·입금 확인·발송 | BLOCKED | BLOCKED | 미생성: `pc_03_shipping.png`, `m_03_shipping.png` |
| 4 | 수령·연장·반납·반송·검수·환불 완료 | BLOCKED | BLOCKED | 미생성: `pc_04_return_done.png`, `m_04_return_done.png` |
| 5 | 양쪽 평가 동시 공개·써보니 후기 | BLOCKED | BLOCKED | 미생성: `pc_05_reviews.png`, `m_05_reviews.png` |
| 6 | 바로 구매·구매 확정·정산 내역 | BLOCKED | BLOCKED | 미생성: `pc_06_settlement.png`, `m_06_settlement.png` |
| 7 | 분쟁 중 검수 차단·운영자 정리·재개 | BLOCKED | BLOCKED | 미생성: `pc_07_dispute.png`, `m_07_dispute.png` |
| 8 | 거래 닫힘·신청 불가·의향 버튼 | BLOCKED | BLOCKED | 미생성: `pc_08_trade_closed.png`, `m_08_trade_closed.png` |
| 9 | 상품 삭제·거래 중 삭제 버튼 없음 | BLOCKED | BLOCKED | 미생성: `pc_09_delete.png`, `m_09_delete.png` |
| 10 | 찜 숫자 즉시 변경·판매자 내 상품 표시 | BLOCKED | BLOCKED | 미생성: `pc_10_wishlist.png`, `m_10_wishlist.png` |
| 11 | 공유 문구 상품명 1회·링크 복사 안내 | BLOCKED | BLOCKED | 미생성: `pc_11_share.png`, `m_11_share.png` |

## 5. 보호 경계 확인

- Codex는 `app/src`, `app/drizzle`, `app/scripts`, `app/dev.db`, `app/runtime-data`에 쓰기 작업을 하지 않았다.
- `127.0.0.1:3000`과 공개 ngrok 주소에서는 거래 행동을 하지 않았다.
- `ADMIN_KEY`, `SESSION_SECRET` 값은 출력하거나 결과에 기록하지 않았다.
- 생성물은 격리 시험 파일(`scratchpad\trade`), 빈 스크린샷 대상 폴더, 이 결과 파일뿐이다.
- 이 검수에서 띄운 격리 서버 PID 19464는 종료했고 당시 `127.0.0.1:3200` 응답 `000`을 확인했다. 이후 외부 동시 작업이 새 PID 36300으로 3200 포트를 다시 열어 현재 200을 반환한다. 소유·환경을 이 세션에서 확인할 수 없어 새 프로세스는 종료하거나 시험에 사용하지 않았다.
- 기존 작업자의 수정 파일과 미추적 `_backup`, 채팅 캡처 폴더는 보존했다.
- 최종 확인 때 검수 시작 시 없던 작업트리 변경이 `app/scripts/import-daangn.cjs`, `app/src/app/api/seller-account/route.ts`, `app/src/app/listings/[id]/page.tsx`, `app/src/app/me/account/page.tsx`, `app/src/app/me/page.tsx`, `app/src/lib/orders.ts`, `app/src/lib/reviews.ts`, `app/src/lib/trade-stats.ts`와 새 파일 `app/scripts/encrypt-seller-holder.cjs`, `app/src/lib/seller-account.ts`에 나타났다. 작성 주체는 이 세션에서 확인할 수 없어 외부 동시 변경으로 분리했고, 덮어쓰기·되돌리기·추가 검수하지 않았다. 본 판정은 요청 커밋 `f277925`의 검수 당시 코드 증거에 대한 것이다.

## 6. 결론과 다음 한 가지 작업

**FAIL** — 코드 결함 6건이 있고 필수 실제 브라우저 시험이 환경 권한 문제로 전부 BLOCKED다. 위 결함을 수정한 같은 브랜치에서, 브라우저 자식 프로세스/새 탭 생성이 허용되는 환경으로 격리 DB·3200 포트 시험 11개를 다시 실행해야 한다.

---

## 7. Claude 수정 반영 (2026-10-09)

| 지적 | 수정 | 확인 |
|---|---|---|
| 2.1 공개 전 평가가 신뢰 숫자에 반영됨 | `trade-stats.ts` sellerTrust 평가 집계에 공개 조건(쌍방 작성 또는 완료 후 reviewRevealDays) 적용 | 상대 미작성: "기록 없음" → 쌍방 작성 후 "0/1회" PASS |
| 2.2 단계 이동 시 멈춘 시간 과다 계산 | `resolveDispute` 멈춘 시간 = 지금 − max(분쟁 시작, 현재 단계 시작) | 배송 중 분쟁(10시간 전) → 2시간 전 받음 → 2시간만 멈춤 PASS |
| 2.3 화면 기한에 늦춘 시간 미반영 | `orderView` 기한 계산에 waitShiftMs 포함, decideBy는 늦춘 trialEndAt 기준 | 발송 기한 = 입금 + 48시간 + 늦춘 시간 PASS |
| 2.4 별점과 반대 문구 저장 | 서버가 `chipsFor(direction, stars)`만 허용, 하나라도 어긋나면 400 | 10점+아쉬운 문구 400, 섞어 보내도 400, 맞는 문구 201 PASS |
| 2.5 계좌 복호화 실패에도 거래 생성 | `createOrder`가 계좌를 먼저 풀어 보고 실패하면 409(주문·예약 없음). 상세의 신청 버튼·MY 등록 표시도 실제로 읽히는 계좌 기준. 계좌 화면에 다시 등록 안내 | 손상 계좌: 409·주문 0·상품 ACTIVE·의향 버튼·안내 PASS |
| 2.6 예금주 평문 저장 | `lib/seller-account.ts`: 계좌번호·예금주를 함께 암호화, holder 열은 가린 이름. 기존 행은 `scripts/encrypt-seller-holder.cjs`로 옮김(두 번 실행해도 안전) | DB holder "홍**동", 본인·구매자 화면은 원문. 실제 DB 1건 옮김(백업 before-holder-encrypt-*), 한군 계좌 정상 읽힘 |

- 시험(격리 3200, 실제 DB 복사본, Playwright PC·모바일): 수정 확인 14/14, 거래 전체 76/76, 검수 지적 회귀 16/16, 계좌 삭제 16/16, 찜 16/16, 단위 43/43
- 브라우저 시험: Codex 실행 환경에서는 BLOCKED였다. Claude가 Playwright로 같은 시나리오를 실행했다(`trade_e2e.py` 등, 캡처 `앱화면_2026-10-08_v1.1\거래\`, `아이콘_삭제\`).
- 다음: Codex 재검수(코드)

---

## 8. Codex 재검수

- 재검수일: 2026-10-09 KST
- 재검수 범위: 결함 6건(2.1~2.6)의 수정 커밋 `16f473a`, 비교 구간 `0662f05..16f473a`
- 확인 방식: 지정 diff와 현재 실제 코드의 정적 대조. Claude 수정표와 시험 수치는 참고 주장으로만 두고 판정 근거로 대신하지 않았다.
- 제외: 사용자 지시에 따라 브라우저·서버·DB·거래 행동은 실행하지 않았다. 따라서 아래 판정은 **6개 코드 수정에 한정**한다.

| 결함 | 재검수 판정 | 실제 코드 근거 |
|---|---|---|
| 공개 전 평가가 판매자 신뢰 숫자에 반영됨(2.1) | **RESOLVED** | `app/src/lib/trade-stats.ts:68-73`에서 판매자 신뢰 집계가 쌍방 평가 작성 또는 거래 완료 후 `reviewRevealDays` 경과 조건을 만족한 평가만 합산한다. 공개 전 단독 평가는 분자·분모에서 제외된다. |
| 분쟁 중 단계 이동 시 현재 단계보다 긴 시간을 멈춤으로 계산함(2.2) | **RESOLVED** | `app/src/lib/orders.ts:540-546`에서 현재 상태별 시작 시각을 고르고, `max(분쟁 시작, 현재 단계 시작)`부터 해소 시점까지로 `pausedMs`를 계산한다. `app/src/lib/orders.ts:551-554`는 그 값만 현재 체험 기한 또는 현재 단계의 `waitShiftMs`에 반영한다. |
| 분쟁으로 연장된 기한이 거래 화면에 반영되지 않음(2.3) | **RESOLVED** | `app/src/lib/orders.ts:433-459`에서 화면용 `after()`가 `waitShiftMs`를 포함해 발송·반송·자동 구매확정·자동 수령 기한을 계산한다. 체험 기한은 연장된 `trialEndAt`을 직접 사용하고 `decideBy`는 그 값에 유예시간만 더해 중복 연장을 피한다. |
| 별점과 반대 의미의 후기 문구를 API로 저장할 수 있음(2.4) | **RESOLVED** | `app/src/lib/reviews.ts:51-58`에서 `chipsFor(direction, stars)`가 허용한 문구만 받으며, 비문자열이나 허용 목록 밖 문구가 하나라도 있으면 저장 전에 `TradeError`로 거부한다. |
| 계좌 복호화 실패에도 빈 계좌로 거래가 만들어짐(2.5) | **RESOLVED** | `app/src/lib/orders.ts:102-106`에서 주문 트랜잭션과 상품 예약 전에 `readSellerAccount()` 결과를 검사하고 실패 시 409 오류를 낸다. 신청 화면도 `app/src/app/listings/[id]/page.tsx:239`에서 실제 복호화 성공 여부로 계좌 준비 상태를 판단한다. |
| 예금주 이름이 평문으로 저장됨(2.6) | **RESOLVED** | `app/src/lib/seller-account.ts:16-27`은 계좌번호와 예금주를 하나의 암호문에 저장하고 `holder` 열에는 가린 이름만 둔다. `app/src/app/api/seller-account/route.ts:38`이 새 저장 경로를 사용하며, 기존 문자열 형식은 `app/scripts/encrypt-seller-holder.cjs:35-40`에서 새 암호문과 가린 이름으로 이전하도록 구현됐다. |

### 새로 생긴 결함

- **없음.** 지정 diff와 변경된 호출 경로에서 이번 6개 수정으로 새로 유입된 재현 가능한 결함을 확인하지 못했다.
- 범위 밖 참고: `app/scripts/import-daangn.cjs:1` 변경은 CommonJS용 ESLint 예외 주석 1줄뿐이며 실행 동작 변경은 없다.

### 보조 확인과 한계

- `git diff --check 0662f05..16f473a`: 이상 없음.
- 변경된 TypeScript/TSX 8개 파일의 현재 언어 서버 오류·경고: 없음.
- 테스트, 브라우저, 서버, 실제 DB 이전 상태는 이번 읽기 전용 재검수에서 재실행·재확인하지 않았다. 특히 기존 예금주 행의 실제 이전 완료 여부는 코드 판정과 별개로 미확인이다.

### 최종 판정

**PASS** — 2.1~2.6의 6개 코드 결함은 모두 **RESOLVED**이며, 지정 수정에서 새 결함은 확인되지 않았다. 이 PASS는 요청된 코드 수정 재검수 범위에만 적용된다.

- Claude 확인(재검수 후): 실제 DB의 기존 예금주 행 이전 완료 — `encrypt-seller-holder.cjs` 실행 결과 "옮김 1", DB holder는 가린 이름, 본인 조회 시 계좌·예금주 정상 복호화(2026-10-09, 백업 before-holder-encrypt-*).
