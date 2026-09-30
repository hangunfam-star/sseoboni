### 작업 결과

외부 테스터 공개는 보류해야 합니다. 코드 검토상 차단 결함 1건(계정 사칭)이 있으며, A~H의 소스·문서 검토를 수행했습니다. 실제 API 호출·DB 저장·화면·타입·린트·빌드는 실행 환경 차단으로 확인하지 못했습니다.

### 작업 지시 요약

Gate 0의 외부 공개 방해 요소를 찾는 읽기 전용 2차 검수입니다. 지정 지시서 전체와 관련 기획·소스·설치된 Next.js 문서를 읽고, 실행 확인과 코드 판단을 구분했습니다. 코드·설정·기존 문서·원본 DB 수정, 패키지 설치, 커밋·push·배포는 하지 않았습니다. 결과물은 이 보고서 하나입니다.

### 남은 일

사본 DB를 이용한 A~E 재현과 F의 세 명령, 실제 화면 및 Git 상태 검증이 남았습니다. 로컬 명령은 Windows 프로세스 생성 오류(접근 거부), Desktop Commander 명령은 승인 필요·승인 정책 never로 거부됐습니다. 임시 폴더와 서버는 만들지 않아 정리할 대상이 없습니다.

**이번 작업 상태:** 부분 검수 — 코드 검토 완료, 실행 검증 미완료.
**필요한 사용자 행동·승인:** 현재 세션의 로컬 명령 실행 권한·실행 환경 복구.
**다음 작업:** 실행 검증 보완 → 차단 결함 수정 여부 결정 → 배포 방식(ngrok / Vercel+Turso) 결정. 최신 상태 문서의 PC 공개 방식 선택은 보존하며 이번에는 배포하지 않음.

---

# 써보니 Gate 0 2차 검수 근거

- 검수일: 2026-09-27, Asia/Seoul.
- 대상: E:\PROJECTS\04_써보니.
- 지시서: CODEX_REVIEW_REQUEST_GATE0_v1.0.md 전체 71줄.
- 우선 보고 규칙: E:\PROJECT_CONTROL_CENTER\00_공통\ALL_PROJECT_REPORTING_RULES_v1.0.md 전체 86줄.
- 결과 파일: E:\PROJECTS\04_써보니\CODEX_REVIEW_RESULT_GATE0_v1.0.md.
- 이 문서의 코드 위치는 1부터 세는 행 번호다.
- **아래 요청·응답 예시는 모두 미실행 재현 계획 또는 코드상 예상이다. 실제 HTTP 응답·DB 저장 증거는 0건이며, 가상의 성공 출력은 기재하지 않는다.**
- 소스 판독은 현재 로컬 파일 기준이다. 동작 재현 없이 판단한 부분은 코드 검토 또는 추정으로 표시한다. 과거 STATUS.md의 성공 기록을 이번 실행 결과로 사용하지 않았다.

## 1. 통합 요구사항 원장

| ID | 요구사항·산출물 | 영향 시스템 | 검증 기준·증거 | 상태·보고 위치 |
|---|---|---|---|---|
| R0 | 지시서·선행 문서 읽기 | 파일 | STATUS, 기획 §60·78·101, app/AGENTS, 공통 지침 읽음 | 문서 검토 완료 · §7 |
| A | 사칭·기록 혼합·최소 보호책 | 인증·DB | session 및 API 데이터 흐름 | 코드 검토 완료 / 재현 미완료 · §2 |
| B | Gate 2 금지선 | 스키마·API | 스키마 10개·마이그레이션·시드·쓰기 경로 | 코드 검토 완료 / 실DB·직접 요청 미확인 · §3 |
| C | 입력·저장·표시 | API·화면 | 경계값별 분기 추적, JSX 확인 | 코드 검토 완료 / 저장·화면 미확인 · §4 |
| D | API별 권한 | 인증·API | 쿠키 없음·본문 타인 ID·위조 쿠키 구분 | 코드 검토 완료 / 호출 미확인 · §5 |
| E | 시장검증 1:1·Q3-2 | 이벤트·수요 | 전체 이벤트 쓰기 위치와 화면 흐름 | 코드 검토 완료 / 수량 실측 없음 · §6 |
| F | 타입·린트·빌드 | 실행 환경 | 명령 프로세스 생성 불가 | 미완료 · §8 |
| G | 문서와 현재 차이 | 파일·Git | 로컬 refs/config 직접 읽음 | 파일 수준 확인 / git status·diff 미확인 · §7 |
| H | Vercel+Turso 준비도 | 배포·DB | 현 구현·공식 자료 대조, 전환 안 함 | 검토 완료 / 배포 시험 제외 · §9 |
| R9 | 사본·임시물 격리 및 정리 | DB·프로세스 | 폴더 미생성, 서버 미기동, 폴더 부재 확인 | 실행 자체 차단 / 정리 대상 없음 · §10 |
| R10 | 보고서 1개·원본 보존 | 저장소 | 결과 파일 사전 부재 확인, 그 외 의도적 쓰기 없음 | 이 보고서 신규 작성 · §10 |

공통 5단계 게이트의 '설정 적용·재시작 후 검증'은 읽기 전용 검수라 해당 없음이다. 소스 검토와 파일 확인까지만 수행했다. 사용자 화면 검증은 미완료이며, 프로젝트 전체 완료로 판단하지 않는다.

## 2. A — 계정 사칭: 차단 1건

### A-01. 닉네임과 서명 없는 사용자 ID 쿠키만으로 타인 행위 가능

- 심각도: **차단 — 외부 공개 전 필수**. 동일 원인의 두 진입 경로를 한 결함으로 집계한다.
- 위치: app/src/lib/session.ts:11–28, :31–33; app/src/app/api/session/route.ts:14–22; app/src/app/api/listings/route.ts:37–65; app/src/app/api/wishlists/route.ts:9–38; app/src/app/api/demand-intents/route.ts:33–62.
- 코드 확인: 닉네임을 `dev_${nickname}`으로 바꾸고 기존 사용자를 그대로 반환한다. 쿠키 값을 읽을 때 서명·세션 저장소·만료·사용자 존재·ACTIVE 상태를 검증하지 않는다. HttpOnly와 SameSite는 임의 HTTP 클라이언트의 쿠키 위조를 막지 않는다.
- 미실행 재현 계획 ①: 서로 독립된 두 클라이언트에서 `POST /api/session {"nickname":"review_alice"}`. 코드상 두 요청은 같은 사용자를 받는다. 실제 응답은 미확인.
- 미실행 재현 계획 ②: 로그인 없이 `Cookie: sseoboni_uid=dev_review_alice`를 보낸다. 이것은 설명용 가상 값이며 실제 세션 값이 아니다. 유효 모델·상품으로 등록/찜/수요 요청을 하고 사본 DB의 소유자와 이벤트 userId를 비교해야 한다.
- 코드상 영향: 상품 sellerId, 찜 userId, 수요 userId, VIEW_LISTING/WISHLIST_ADD/DEMAND 이벤트가 같은 ID로 귀속된다. 타인의 찜 조회·추가·해제도 가능하도록 작성되어 있다. 존재하지 않는 사용자 ID는 상품·수요 FK에 걸릴 수 있지만, wishlists.userId에는 사용자 FK가 없어 동일 보호가 없다(app/src/db/schema.ts:88).
- 최소 보호책: 테스터마다 추측 불가능한 개인 초대 코드 또는 일회용 개인 링크를 발급하고, 검증 뒤 서버가 발급한 무작위 세션으로 고정 userId에 연결한다. 닉네임은 표시용으로만 사용한다. 세션 만료·폐기 및 사용자 상태를 서버에서 확인한다. 공용 초대 코드나 공용 터널 비밀번호만으로는 내부 테스터 사이의 사칭이 해결되지 않는다.
- 완료 확인 기준: 타인 닉네임 재사용 및 임의 userId 쿠키가 타인 세션을 만들지 않고, 모든 보호 API가 같은 세션 검증을 사용해야 한다. 이번에는 수정·발급하지 않았다.

## 3. B — Gate 2 금지선

**코드 검토:** schema.ts와 단일 SQL 마이그레이션에는 users, seller_profiles, buyer_profiles, categories, product_models, listings, listing_components, wishlists, demand_intents, market_validation_events의 10개 테이블만 있다. Payment/Refund/Settlement/SettlementHold/Chargeback/Transaction/TrialPolicy/ConditionSnapshot/Dispute는 구현 엔티티가 아니며, 주석에 금지 대상으로만 등장한다. trialPolicyId 문자열과 신뢰 통계 필드는 거래 엔티티 구현 자체가 아니다. 실제 dev.db의 sqlite_master는 실행 제한으로 조회하지 못했다.

- API: app/src/app/api/listings/route.ts:43, :57–66은 허용된 필드만 꺼내고 trialEnabled:false를 명시한다. 본문에 trialEnabled:true, trialPolicyId, sellerId를 넣어도 해당 값이 values로 전파되는 경로는 없다.
- 시드: app/src/db/seed.ts:6–30은 카테고리 trialEnabled:false와 모델 3개만 삽입한다. listing을 만들지 않는다.
- UI: app/src/app/listings/[id]/page.tsx:43–45의 신청 버튼은 항상 disabled다.
- 직접 HTTP 요청의 true 우회 거부는 **코드상 확인, 실제 요청 미실행**이다. PAID_TRY_INTENT 수요 기록은 결제 실행이 아니므로 Gate 2 위반으로 집계하지 않는다.

### B-01. DB 자체는 trial_enabled=false 불변식을 강제하지 않음

- 심각도: 중요(방어 범위 제한). **외부 HTTP 우회 발견을 뜻하지 않는다.**
- 위치: app/src/db/schema.ts:71; app/drizzle/0000_fat_princess_powerful.sql:51.
- 코드 확인: DEFAULT false는 기본값이며 false만 허용하는 CHECK나 트리거가 없다.
- 미실행 재현 계획: 사본 DB에서 `UPDATE listings SET trial_enabled=1 WHERE id=:test_id`. 코드·DDL상 이를 막는 제약이 없다. 실제 실행·영향 행 수는 미확인.
- 수정 방향: Gate 2 이전 쓰기 경계를 공통화하고 필요하면 DB CHECK로도 금지선을 보장한다. API에서 true를 명시한 요청을 400으로 거부할지, 현재처럼 무시할지도 명세화한다.

## 4. C — 입력값 검증

### C-01. 가격·길이·공백·수요 범위 검증 누락

- 심각도: 중요.
- 위치: app/src/app/api/listings/route.ts:43–65; app/src/app/api/session/route.ts:16–20; app/src/app/api/demand-intents/route.ts:38–55; app/src/app/listings/new/page.tsx:48–59.
- 아래는 전부 **미실행 입력 예시와 코드상 예상**이며 실제 저장 결과가 아니다.

| 입력 | 코드상 분기·위험 |
|---|---|
| price:-1 | truthy이므로 필수 검사 통과, Number(-1)을 DB에 전달 |
| price:0 / price:"0" | 숫자 0은 400 분기, 문자열 "0"은 통과 후 0으로 변환; 등록 UI는 문자열 전송 |
| price:1e20 또는 안전 정수 범위를 넘는 값 | 유한수·안전 정수·허용 상한 검사 없음; DB 드라이버의 저장·거부·정밀도 결과는 미확인 |
| title:"" / title:"   " | 빈 문자열은 400 분기, 공백만 있는 값은 통과 |
| 제목·설명·닉네임 길이 초과 | 앱 자체 최대 길이 없음; 실제 HTTP/쿠키 전송 한계는 미측정 |
| conditionGrade:"UNKNOWN" | enum 검증 없음; UI 선택지를 직접 요청으로 우회 가능 |
| desiredPriceMin:100, desiredPriceMax:10, desiredTrialHours:-1 | 순서·음수·정수 범위 검사 없이 Number 변환 |
| desiredPriceMin:0 / desiredPriceMin:"0" | 숫자 0은 null로 변환, 문자열 "0"은 0; 관측값과 결측값 혼동 |
| nickname:{} | String 변환으로 "[object Object]" 계정 후보가 됨; 문자열 타입 검사 없음 |
| price:"abc", null JSON, 잘못된 JSON | 검증·예외 처리 불충분; 정확한 실패 응답은 실행 확인 필요 |

- 수정 방향: 서버에서 타입·trim 후 비어 있음·최대 길이·허용 등급·유한한 안전 정수·가격 상하한·min≤max를 검증한다. 0 허용 여부는 제품 정책으로 정하되 문자열/숫자에 같은 규칙을 적용한다. 미입력은 null로 유지한다.

### C-02. 잘못된 참조 ID와 예외가 일관된 오류 응답으로 처리되지 않음

- 심각도: 중요.
- 위치: app/src/app/api/wishlists/route.ts:21–36; app/src/app/api/demand-intents/route.ts:38–56; app/src/db/client.ts:7.
- 코드 확인: 상품 등록은 존재하지 않는 modelId에 400을 명시한다. 상세 API는 존재하지 않는 id에 404를 명시한다. 반면 찜은 listingId 존재를, 수요는 modelId 존재를 미리 확인하지 않고 FK에 맡긴다. JSON 파싱·DB 오류에 대한 예외 처리도 없다.
- 미실행 재현 계획: 정상 세션으로 `POST /api/wishlists {"listingId":"missing-id"}`, `POST /api/demand-intents {"modelId":"missing-id","intentType":"LOOKING_TO_BUY"}`. FK 오류 및 5xx 가능성은 추정이며 실제 응답 본문은 없다. 객체·배열형 ID도 타입 검사 없이 전달된다.
- 수정 방향: 참조 존재·활성 상태 확인, 400/404 구분, 예외의 안전한 JSON 응답을 통일한다. 비활성 모델도 등록 API에서 걸러야 한다(현재 모델 드롭다운만 active 필터).

**HTML/스크립트 구분:** 제목·설명에 `<script>alert(1)</script>` 또는 `<img src=x onerror=alert(1)>`를 넣는 실제 저장·브라우저 시험은 못 했다. 코드상 텍스트 필드로 전달되며 app/src/app/page.tsx:53–55 및 app/src/app/listings/[id]/page.tsx:36–39는 JSX 텍스트로 렌더링한다. 원시 HTML 삽입 경로는 app/src 전체에서 발견하지 않았다. 따라서 서버에 HTML 문자열을 허용한다는 이유만으로 실행형 XSS가 확인됐다고 판단하지 않는다. React 텍스트 이스케이프 대상이라는 코드 판단과 실제 화면 검증은 구분한다.

### C-03. 찾는 상품의 한쪽 가격만 입력하면 표시 누락·불완전 표시

- 심각도: 경미.
- 위치: app/src/app/demand/page.tsx:77.
- 미실행 재현 계획: 최소 가격 없이 최대 가격만 등록하면 코드상 가격 부분을 숨긴다. 최소만 등록하고 최대가 null이면 템플릿에 undefined가 들어갈 수 있다. 숫자 0도 truthy 조건에서 숨겨진다. 실제 화면은 미확인.
- 수정 방향: 양쪽 null 여부로 분기하여 '이하/이상/범위'를 각각 표시한다.

## 5. D — API별 권한 경계

아래 상태·응답은 **명시된 코드 분기**이며 실제 HTTP 기록이 아니다. 별도 role/status 검사는 없다.

| API | 쿠키 없는 요청 | 타인 명의 본문·쿠키 |
|---|---|---|
| GET /api/session | 200 코드 분기, user:null | 쿠키 ID로 사용자를 조회; 미존재 ID는 명확한 세션 오류 처리 없음 |
| POST /api/session | 닉네임만으로 생성/재사용 가능 | A-01 사칭 경로 |
| GET /api/models | 공개 조회 | 사용자 명의 입력 없음 |
| GET /api/listings | ACTIVE 목록 공개 | 사용자 명의 입력 없음 |
| POST /api/listings | 401 | 본문 sellerId 무시, 쿠키 ID 사용; 임의 쿠키는 신뢰 |
| GET /api/listings/[id] | 공개 조회 및 익명 이벤트 기록 | 임의 쿠키 ID가 이벤트에 들어감 |
| GET /api/wishlists | 200 코드 분기, 빈 목록 | 위조 쿠키 ID의 찜 조회 |
| POST /api/wishlists | 401 | 본문 userId 무시, 위조 쿠키의 찜 토글 |
| GET /api/demand-intents | 수요 공개 목록, userId는 select에서 제외 | '내 수요' API가 아니므로 공개 자체를 권한 결함으로 보지 않음 |
| POST /api/demand-intents | 401 | 본문 userId 무시, 위조 쿠키 ID로 저장 |

### D-01. 숨김·제거 상품도 ID만 알면 상세 접근 경로가 열림

- 심각도: 중요.
- 위치: app/src/app/api/listings/[id]/route.ts:11; app/src/app/listings/[id]/page.tsx:11.
- 코드 확인: 목록은 ACTIVE만 표시하지만 상세 두 경로는 id만 검사한다.
- 미실행 재현 계획: 사본의 테스트 listing을 HIDDEN 또는 REMOVED로 바꾼 뒤 상세 API·페이지 요청. 코드상 조회와 이벤트 쓰기까지 진행할 수 있다. 현재 DB에 그런 레코드가 있는지는 미확인.
- 수정 방향: 공개 가능 상태를 공통 판정하고 소유자 검토가 필요하면 별도 인증 경로로 분리한다. 판매완료 상품 공개 정책은 임의로 결정하지 않는다.

## 6. E — 시장검증 데이터와 Q3-2

### E-01. HTTP·렌더 횟수와 실제 사용자 행동이 구분되지 않음

- 심각도: 중요.
- 위치: app/src/app/api/listings/[id]/route.ts:23–28; app/src/app/listings/[id]/page.tsx:17–22; app/src/app/api/wishlists/route.ts:31–41; app/src/app/api/demand-intents/route.ts:47–62; app/src/app/page.tsx:12–29.
- 코드 확인: API 상세 GET와 상세 페이지 렌더 각각 VIEW_LISTING을 삽입하며, 방문/중복 식별자가 없다. 봇·반복 GET·새로고침이 발생할 때 각 서버 실행이 별도 이벤트가 되는 구조다. **페이지가 상세 API도 호출하는 구조는 아니므로 한 번 화면을 보면 무조건 두 건이라고 단정하지 않는다.** 프리페치가 실제 몇 건을 추가하는지도 측정하지 못했다.
- 찜 ADD는 추가 때만 기록하고 해제 이벤트는 없다. 추가→해제→추가하면 현재 찜은 1개라도 ADD 이력은 누적된다. 이는 '추가 행동 수'에는 쓸 수 있지만 '유일 구매 의향 사용자 수'로 그대로 쓸 수 없다.
- 수요 POST는 동일 사용자·모델·의향의 중복 방지나 요청 멱등성이 없다. 재전송과 반복 클릭이 수요 및 이벤트를 추가할 수 있다. 수요 화면에도 제출 중 잠금이 없다.
- 홈 검색과 목록 API에는 SEARCH 이벤트가 없다. 상품 등록·비용 노출 전후·판매자 WTA·이탈 사유 기록 경로도 확인되지 않았다.
- 미실행 재현 계획: 같은 상세 GET 3회, 찜 추가→해제→추가, 동일 수요 POST 2회를 보내고 사본 DB 차이를 비교한다. 실제 건수는 미측정.
- 수정 방향: 원시 이벤트 이력과 유일 사용자·세션 집계를 분리하고, 요청 ID/중복 기준·봇/테스트 표식·SEARCH·해제 이벤트를 정의한다. 수요 생성에는 중복 의도 여부를 구분하는 갱신·멱등 정책이 필요하다.

### E-02. 본체 저장과 이벤트 저장이 분리돼 기록 누락 가능

- 심각도: 중요.
- 위치: app/src/app/api/wishlists/route.ts:36–41; app/src/app/api/demand-intents/route.ts:47–62; app/src/lib/session.ts:22–28.
- 코드 확인: 찜·수요 삽입 후 이벤트를 별도 저장하며 트랜잭션으로 묶지 않는다. 사용자 생성·구매자/판매자 프로필 생성도 분리되어 있다.
- 미실행 재현 계획: 사본에서 두 번째 쓰기 실패를 주입하고 첫 번째 레코드 잔존을 확인한다. 장애 재현은 못 했으며 부분 저장 가능성은 코드상 판단이다. 실패 후 재시도하면 수요 중복 또는 찜 토글 반전도 가능하다.
- 수정 방향: 함께 성공해야 하는 쓰기를 트랜잭션으로 묶고 재시도 시 멱등성을 보장한다. 이벤트 기록 오류가 공개 상세 조회 전체를 실패시킬지도 별도 정책으로 정한다.

**Q3-2 판단:** 현재 데이터는 탐색·등록 등 초기 행동의 보조 관찰 자료로 한정해야 한다. 사칭·중복·누락 때문에 사람 수와 수요 전환율의 근거로 바로 사용할 수 없다. PAID_TRY_INTENT는 '유료 체험 의향'일 뿐 제시된 체험료의 수락, 실제 결제 또는 매출이 아니다. desiredPriceMin/Max만으로 체험료 WTP를 확정할 수 없고, 판매자 WTA와 비용 공개 전후 비교도 없다. §101 Validation MVP 전체 또는 수익성 가설 검증 완료로 선언할 수 없다. 모든 §101 기능을 이번 Gate 0의 차단 결함으로 추가한 것은 아니다.

## 7. G — 문서·Git·확인 범위

| 항목 | 이번 확인 | 한계 |
|---|---|---|
| STATUS.md 'origin 미연결' | .git/config에 origin과 지정 GitHub 원격 설정이 존재 | 실시간 원격 fetch·연결 시험 안 함 |
| 기준 브랜치·커밋 | .git/HEAD는 refs/heads/main, local main과 origin/main 로컬 참조가 아래 동일 커밋 | git status·diff·log 명령은 실행 못 함; 작업 트리 청결이나 최신 서버 동기화는 단정 불가 |
| STATUS.md API·화면·테이블 수 | API route 파일 6개, 화면 page 5개, 스키마 테이블 10개 확인 | 실DB 테이블 수는 미확인 |
| STATUS.md 'XSS 방어 로직 없음' | 서버 검증은 부족하나 JSX 텍스트 경로가 있음 | 실행형 XSS 확인으로 해석하면 과장 |
| STATUS.md trialEnabled 강제 | 현재 상품 등록 API는 false 상수 | DB 전체 경로까지 false 불변식을 보장하는 것은 아님 |
| 과거 tsc·curl 성공 기록 | 문서에 기록된 역사적 주장으로 구분 | 이번 시험 통과 근거로 사용하지 않음 |
| Control Center PROJECT/CURRENT_STATE 앞부분 '앱·Git 없음' | 현재 app/src 및 .git 존재와 불일치 | 2026-09-27 후반 추가 기록에는 앱·검수·PC 공개 선택이 기록됨 |

확인된 로컬 참조 커밋: 78f387d426f8ef699ea35eb4076aa7a2a55701b9. 원격 URL 문자열은 지정 저장소와 일치하는지만 확인했고 인증정보는 출력하지 않았다.

선행 문서: STATUS.md 전체, 마스터기획 §60·78·101 전체, 루트 AGENTS/CLAUDE, app/AGENTS, MASTER_REGISTRY, WORKFLOW, COMPLETION_GATE, Control Center의 프로젝트 PROJECT/CURRENT_STATE를 읽었다. 저장소 루트에는 PROJECT.md와 CURRENT_STATE.md가 없어 Control Center 소속 문서를 확인했다. 과거 상태 문서는 수정하지 않았다.

소스 범위: app/src의 TS/TSX/CSS 전체(6 API, 5 page, WishlistButton, layout, globals.css, db 3개, session), package.json, drizzle.config.ts, SQL 마이그레이션 및 journal, next.config.ts, tsconfig.json, eslint.config.mjs. favicon.ico는 코드 검수 대상에서 제외했다. 설치 Next.js package.json은 16.3.6이며 동봉 Route Handlers·cookies·Server and Client Components 관련 문서를 확인했다. 문서 읽기 도구의 큰 출력 일부가 잘렸으므로 관련 핵심 동작 범위에 한정해 판단했다.

UI 다듬기·구성품 입력·찾는 상품 알림은 지시서의 알려진 미구현으로 유지하고 별도 결함 수에 넣지 않았다. 이 보고서는 코드 및 문서의 현재 상태 판단이며 다른 에이전트에게 전달·수신·수정이 완료됐다는 보고가 아니다.

## 8. F — 타입·린트·빌드와 실행 차단 증거

| 요청된 명령 | 이번 결과 | 판정 |
|---|---|---|
| npx tsc --noEmit | 실행 못 함, 종료 코드 없음 | 미확인 |
| npm run lint | 실행 못 함, 종료 코드 없음 | 미확인 |
| npm run build | 실행 못 함, 종료 코드 없음 | 미확인 |

실패한 것은 앱의 테스트가 아니라 명령 실행 통로다.

1. 기본 exec_command의 파일 읽기 명령: CreateProcessAsUserW failed: 5 (액세스가 거부되었습니다.). 작업 경로는 대상 저장소였고 pwsh.exe 프로세스 생성 단계에서 실패.
2. 다른 PowerShell 경로를 지정한 Get-Location 진단도 같은 실행 호스트 오류로 실패. 도구가 보고한 실행 파일은 여전히 WindowsApps의 pwsh.exe였으므로 대체 셸 성공으로 보고하지 않는다.
3. Desktop Commander의 결과 파일 존재 확인용 PowerShell 명령: "MCP tool call requires approval, but approval policy is never". 설정을 변경하거나 다른 도구로 승인 정책을 우회하지 않았다.
4. 파일 읽기·Serena 검색은 가능했으므로 A~H의 독립적인 정적 검토를 계속했다.

재개 시에는 기존 node_modules만 사용하고, .codex_review_tmp 안의 격리 작업 공간·사본 DB로 시험해야 한다. tsc의 incremental 캐시와 Next dev/build 출력도 임시 경로에 한정해야 한다. next dev는 agent 파일을 자동 생성할 수 있다는 app/AGENTS.md 설명이 있으므로 원래 app에서 실행해 기존 파일에 쓰게 하면 안 된다. 기존 코드·설정 변경이나 패키지 설치로 시험 조건을 맞추지 않는다.

## 9. H — Vercel + Turso(libSQL) 전환 장애 목록

이번에는 전환·설치·계정 생성·유료 호출·배포를 하지 않았다. 아래는 현 파일과 공식 문서의 대조이며 실제 배포 시험 결과가 아니다.

| 장애·확인 지점 | 현재 근거 | 필요한 방향 |
|---|---|---|
| 로컬 파일 SQLite | app/src/db/client.ts:1–9, better-sqlite3 및 drizzle-orm/better-sqlite3 사용 | libSQL용 클라이언트·Drizzle 어댑터 연결을 별도 검증; URL 교체만으로 원격 DB가 되지 않음 |
| 파일 경로 기본값 | client.ts:5는 file:만 제거하고 ./dev.db로 폴백 | 원격 URL·인증 토큰 명시, 배포 환경 누락 시 로컬 파일로 조용히 폴백하지 않게 함 |
| WAL·FK pragma | client.ts:6–7에서 로컬 객체의 pragma 호출 | 원격 DB 방식에 맞는 초기화·제약 검증; WAL 호출을 그대로 원격 연결에 적용할 수 있다고 가정하지 않음 |
| 마이그레이션 대상 불일치 | app/drizzle.config.ts:8은 ./dev.db 고정, 런타임 DATABASE_URL을 사용하지 않음 | 배포 대상 분리·기존 SQL 호환성·적용 이력·데이터 이전 절차 검증 |
| 시드 중복 | seed.ts:6–30은 조회/upsert 없이 새 카테고리·모델 삽입 | 재실행해도 중복되지 않게 설계; 운영 시드·검수 이벤트 분리 |
| 빌드 시 DB 연결 | 모듈 import 때 바로 Database 생성; 여러 서버 화면이 DB 직접 조회 | 빌드 환경 DB·읽기/쓰기 범위와 원격 장애 처리 검증; 현 build 실패 여부는 미확인 |
| 네이티브 의존성·동작 변경 | better-sqlite3 네이티브 패키지, 동기 로컬 드라이버 | 타깃 런타임·원격 비동기 동작·트랜잭션·동시 요청 회귀검증 |
| 사용자·이벤트 신뢰성 | A-01, E-01, E-02 | 배포 플랫폼을 바꿔도 사칭·중복 문제가 해결되지는 않음 |

Vercel의 함수 환경은 영속적인 단일 로컬 SQLite 저장소를 보장하지 않는다. 이 때문에 현재 dev.db를 그대로 배포하는 방식은 영속 DB 설계가 되지 않는다. [Vercel 공식 SQLite 안내](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)

Turso Cloud 연결은 libSQL용 클라이언트·어댑터를 사용하는 별도 연결 경로다. 최신 예제를 현재 설치된 Drizzle 0.44 계열에 그대로 적용 가능한지는 추가 버전 검증이 필요하다. [Drizzle 공식 Turso Cloud 문서](https://orm.drizzle.team/docs/sqlite/connect-turso)

현재 원장의 최신 공개 방식은 PC 기반이다. 이 절은 요청된 전환 준비도 검토이며 Vercel 전환 결정이나 PC 외부 공개 승인이 아니다.

## 10. 경계 준수·정리·종료 게이트

- 보고서 존재 확인: 작업 시작 시와 작성 직전에 ENOENT를 확인했다. 기존 보고서를 덮어쓰지 않도록 신규 작성했다.
- 원본 app/dev.db를 DB 엔진으로 열거나 쓰는 명령은 실행하지 않았다. 원본 DB 해시·행 수의 전후 비교는 실행 차단으로 수행하지 못했다. 다른 실행 중인 프로그램의 변경 여부까지 보존됐다고 단정하지 않는다.
- app/dev.db-wal과 dev.db-shm의 존재는 디렉터리 조회로 확인했다. 재개 시 DB 본체만 무조건 복사하지 말고 원본에 쓰지 않는 일관된 스냅샷 방법을 검증해야 한다.
- .codex_review_tmp는 만들지 않았으며 종료 전 디렉터리 조회에서도 NOT_FOUND였다. 따라서 임시 DB·스크립트·로그·폴더 삭제는 수행할 대상이 없었다.
- dev 서버를 띄우지 않았으므로 선택한 포트·생성 PID·종료 PID는 없다. 기존 서버에 요청하거나 기존 프로세스를 종료하지 않았다. 실제 시험을 재개하면 3100 이상 빈 포트와 이번에 만든 PID만 사용한다.
- 코드·설정·기존 문서 수정, 패키지 설치·업그레이드, 브랜치 생성, 커밋·push·merge, 외부 메시지·공개·결제는 하지 않았다.
- Git 명령 실행이 불가하므로 전체 작업 트리 변경 목록을 증명하지 못했다. 의도적으로 작성한 산출물은 본 보고서 하나이며, 도구 내부 캐시나 다른 프로세스 변경까지 없는 것으로 단정하지 않는다.
- CURRENT_STATE.md 갱신 및 별도 공통 보고 파일 생성은 '기존 문서 수정 금지·새 파일 하나'라는 이번 명시 지시에 따라 제외했다. 마스터 채널 전송도 하지 않았다.
- 결함 집계: 차단 1건(A-01), 중요 6건(B-01, C-01, C-02, D-01, E-01, E-02), 경미 1건(C-03). 전부 코드 검토 판단이며 실제 재현 완료 건수로 읽으면 안 된다. H는 전환 준비 항목으로 별도 관리한다.
- 종료 판정: 정적 검토 보고서 작성 범위와 실행 미완료를 구분한다. Gate 0 통과·외부 공개 가능·전체 검수 완료를 선언하지 않는다. 현재 실행 환경 복구 후 사본 DB 시험이 먼저 필요하며, 구현 수정은 별도 결정 대상이다.

