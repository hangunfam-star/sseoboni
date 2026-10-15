# Codex 검수 요청서 v1.7 — 상품 점검·반품 확인 (2026-10-15, Claude)

## 배경
사용자 지시: "써보니 등록 시 상품마다 체크할 부분, 구매자가 써보고 반품할 때 체크할 프로세스" — 1~4번 진행, 5번(차감)은 제안만(`reports/2026-10-15-반납-차감-정책-제안.md`, 개발 없음).
v1.6 재검수(e8b4cf6)와 별개다. 운영 배포는 v1.6·v1.7 검수 통과 뒤에 한다(DB 마이그레이션 0017 포함).

## 만든 것

| 번호 | 내용 | 주요 파일 |
|---|---|---|
| 1 | 등록·수정에 품목별 판매자 점검표(노트북·태블릿·스마트폰·오디오·카메라·게임기·생활가전·신발·의류, 그 밖은 공통). 써보기 상품은 모든 항목 필수(API 400), 바로 판매는 선택. 상세에 "판매자 점검표", 신청 때 거래 기록에 고정. 사진 각도 안내 문구 | `app/src/ui/check-items.ts`, `app/src/components/CheckFields.tsx`, `app/src/app/api/listings/route.ts`, `app/src/app/api/listings/[id]/route.ts`, `app/src/app/listings/new/page.tsx`, `app/src/app/listings/[id]/edit/page.tsx`, `app/src/app/listings/[id]/page.tsx` |
| 2 | 받을 때 확인: 구성품별 "왔어요", 설명·점검표와 같은지(달라요면 5자 이상), 받은 상태 사진(써보기 1장 이상 필수, 바로 구매 선택). 다르거나 빠지면 채팅 안내 | `app/src/lib/orders.ts`(RECEIVED), `app/src/app/orders/[id]/OrderActions.tsx` |
| 3 | 반송 전 확인: 구성품별 "넣었어요", 노트북·태블릿·스마트폰·게임기는 초기화·로그아웃 체크 필수, 포장 전 사진 1장 이상 | `orders.ts`(RETURN_SHIPPED), `OrderActions.tsx` |
| 4 | 판매자 검수: 상태(보낼 때와 같음 / 새 흠집·손상 / 작동 이상) 필수, 같지 않으면 내용 5자 이상 + 사진 1장 이상. 거래 화면 "상태 확인 기록"에 점검표·받을 때·보낼 때·검수를 나란히(양쪽 다 봄). 환불액은 바꾸지 않음(차감은 분쟁) | `orders.ts`(INSPECT), `app/src/app/orders/[id]/page.tsx` |
| 공통 | 거래 증거 사진: 단계·역할·상태가 맞을 때만 올림(최대 5장), 당사자·운영자만 봄, 공개 사진 주소(`/api/photos/[file]`)로는 열리지 않음 | `app/src/app/api/orders/[id]/photos/route.ts`, `.../photos/[file]/route.ts`, `app/src/app/api/photos/[file]/route.ts`, `app/src/components/StagePhotos.tsx` |
| DB | 0017: `listings.check_items`, `orders.arrival_check`, `orders.pack_check`, 새 표 `order_photos` | `app/drizzle/0017_checks.sql` |

## Claude 자체 시험(2026-10-15, 격리 서버)
- 새 시험 `ops/e2e/suites/test_checks.py` 55/55(휴대폰 375px·PC 1280px, 화면 클릭·입력·사진 올리기, API 우회 시도, 사진 권한)
- `ops/e2e/legacy/trade_e2e.py` 81/81(새 확인 단계에 맞게 고침, 원래 76 + 5)
- `ops/e2e/suites/test_test_listings.py` 20/20, 단위 50/50(점검표 규칙 5개 추가), tsc·eslint·`git diff --check` 통과
- 캡처: `ops/e2e/.out/shots/{m,pc}_{new_checks,arrival,pack,inspect,record}.png`(저장소 밖 .out, 다시 만들 수 있음)

## 검수 요청
1. 위 1~4와 공통 항목이 요구대로 동작하는지 코드·격리 서버·실제 브라우저로 확인.
2. 특히: 써보기 상품 점검표 우회(수정 API로 비우기, 써보기 켜기), 증거 사진을 다른 사람·다른 단계·끝난 단계에서 올리거나 보기, 자동 받음 처리(확인 없이) 뒤 화면, 분쟁 중 단계 동작.
3. 기존 써보기 상품(점검표 없음)을 수정할 때 점검표를 요구하는 것이 의도대로인지(사용자 영향) 확인.
4. 결과: `CODEX_REVIEW_RESULT_GATE0_v1.7.md`
