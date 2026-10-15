# Codex 재검수 요청서 v1.8 — 상품 점검·반품 확인 지적 2건 수정 (2026-10-15, Claude)

## 배경
Codex 검수 v1.7(`CODEX_REVIEW_RESULT_GATE0_v1.7.md`) FAIL, 지적 2건. 사용자 결정(2026-10-15): 결함 1 수정 진행, 결함 2는 A안(자동 받음 유지 + 표시 + 24시간 늦은 확인 + 사전 안내). 운영 배포는 v1.6·v1.7·v1.8 통과 뒤.

## 고친 것

| v1.7 지적 | 고친 내용 | 파일 |
|---|---|---|
| 결함 1: 지운 증거 사진이 공개 주소에서 열림 | 거래 증거 사진을 상품 사진과 다른 폴더(`runtime-data/order-uploads`)에 저장. 공개 사진 주소는 상품 폴더(`runtime-data/uploads`)만 읽으므로 증거 사진은 지우기 전·후 모두 열리지 않음. 지울 때 기록과 실제 파일을 함께 삭제 | `app/src/lib/photos.ts`, `app/src/app/api/orders/[id]/photos/route.ts`, `.../photos/[file]/route.ts` |
| 결함 2: 자동 받음 때 수령 확인 없음 | ① 자동 받음 뒤 실제 처리 시각부터 24시간 안에 구매자가 "받은 물건 확인"(같은 규칙: 같은지·다르면 5자·써보기는 사진 필수)을 늦게 올릴 수 있음(`ARRIVAL_CHECK`, 상태는 그대로, 기록에 "자동 받음 뒤 늦게 확인"). ② 기한 안 받을 때 사진도 올릴 수 있음. ③ 확인이 없으면 상태 기록에 "자동 받음 · 구매자 확인·사진 없음"과 "판매자 등록 사진·점검표가 상태 기준" 표시. ④ 미리 안내: 배송 중 구매자 할 일 문구, 자동 받음 채팅 안내. 마감 뒤에는 늦은 확인·사진 409 | `app/src/lib/orders.ts`(lateArrivalUntil·arrivalFrom·ARRIVAL_CHECK·receiveTx 안내), `app/src/app/api/orders/[id]/route.ts`, `app/src/app/orders/[id]/OrderActions.tsx`, `app/src/app/orders/[id]/page.tsx`, `app/src/ui/check-items.ts` |

## Claude 자체 시험(2026-10-15, 격리 서버)
- 새 시험 `ops/e2e/suites/test_checks_fix.py` 31/31(휴대폰 375px·PC 1280px): 증거 사진 저장 위치·지우기 전후 공개 주소 404·파일 삭제, 자동 받음 표시·늦은 확인 화면 입력·사진 필수·판매자 거부·두 번 금지·마감 뒤 409·마감 뒤 표시
- 회귀: `test_checks.py` 55/55, `legacy/trade_e2e.py` 81/81, 단위 50/50, tsc·eslint 통과
- 캡처: `ops/e2e/.out/shots/{m,pc}_late_arrival.png`

## 재검수 요청
1. 결함 1·2가 고쳐졌는지 직접 재현으로 확인(지운 사진 공개 주소, 자동 받음 뒤 기록·늦은 확인·마감).
2. 운영 서버에서 `runtime-data`가 볼륨으로 붙어 있어 `order-uploads`도 재시작 뒤 남는지 배포 설정(`ops/deploy.sh`) 기준으로 확인.
3. 실제 브라우저(휴대폰 375px·PC 1280px) 클릭·입력·사진 올리기와 스크린샷 경로.
4. 결과: `CODEX_REVIEW_RESULT_GATE0_v1.8.md`
