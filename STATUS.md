<!-- CLAUDE_UPDATE:2026-10-08 -->
# 써보니 최신 상태 (Claude, 2026-10-08)
- 브랜치 `gate0/market-ui`, 커밋 24ba087(푸시 완료). main 병합은 사용자 승인 전 금지.
- Gate 0 범위 개발 완료: 닉네임 시작, 상품 등록(직접 입력·사진·구성품), 수정·사진 삭제, 리스트·검색(20개씩), 상세, 찜, 찾는 상품(직접 입력), 써보기 의향 기록, 의견 보내기, 운영자 결과(/admin, CSV).
- 운영자 키: `app/.env`의 `ADMIN_KEY`(값 기록 금지).
- 1차 검증: tsc·eslint 0, test:ui 21/21, Playwright 34/34(격리 서버). 2차 검수 요청서: `CODEX_REVIEW_REQUEST_GATE0_v1.2.md`.
- 정책 결정 대기: 써보기 비용 공개 화면, GO/MODIFY/STOP 판정 기준.

---
<!-- AI_NEUTRAL_HANDOFF:2026-10-01 -->
# 써보니 AI 중립 인계 최신 스냅샷

- 마지막 독립 대조: 2026-10-01 22:20 KST
- 공통 정본: `E:\PROJECT_CONTROL_CENTER\00_공통\PROJECT_WORK_RULES.md`
- 실제 저장소: `E:\PROJECTS\04_써보니`
- Git 기준: branch `gate0/market-ui`, HEAD `a6b45a57c784e1011b2fe75ddc53aa5658494874`.
- 인계 갱신 직전 working tree: tracked modified 9개, untracked 1개(`CODEX_REVIEW_RESULT_GATE0_UI_v1.1.md`). 수정에는 관리 문서와 invite/UI/test 파일이 함께 있으므로 병합·정리 전 파일별 diff를 확인한다.
- 현재 담당·진행: 제품 작업 착수자는 `미확인`; GPT는 이번에 문서 상태만 기록했다. 기존 Claude 세션은 `7eb1f6e0-b5b6-4f06-ac1d-bac1a8a43430`.
- 기존 작성자 자료: 아래 STATUS와 `CODEX_REVIEW_REQUEST_GATE0_UI_v1.1.md`는 Gate 0 범위와 과거 개발 상태를 설명한다.
- 과거 2차 검수 자료: `CODEX_REVIEW_RESULT_GATE0_UI_v1.1.md`는 당시 차단 0, P2 `F-02`(탭 높이), `G-02`(Turbopack 추적 경고)를 기록한다. 현재 working tree가 두 항목을 해소했는지는 이번에 실행 검증하지 않았다.
- 독립 대조: branch·HEAD·변경 파일 목록만 확인했다. 현재 변경의 Claude 1차 재검수와 GPT 2차 재검수는 `NOT_RUN`; 새 규칙 기준 기능 완료를 선언하지 않는다.
- 결함대장: 최소 열린 후보 `F-02`, `G-02`. 담당·수정 근거·PC/모바일·링크·간격/겹침/잘림·1차/2차 재검수와 종결 여부를 다음 검수에서 갱신한다.
- 실행 방법: `app\package.json` 실측 기준 `npm run test:ui`, `npm run build`, `npm run dev`가 현재 진입점이다. `CODEX_REVIEW_RESULT_GATE0_UI_v1.1.md`의 당시 판정은 `PASS WITH NON-BLOCKING NOTES`, 차단 0, P2 F-02/G-02다. 이번 문서 작업에서는 npm 실행·DB 복제·브라우저·ngrok·배포·commit/push/merge를 하지 않았으므로 현재 종결 여부는 여전히 `NOT_RUN`이다.
- 승인·차단: main 병합, 외부 테스터 공개, 운영성 데이터·권한 변경은 사용자 승인 전 실행하지 않는다.
- 다음 행동: 현재 diff와 F-02/G-02 대응을 Claude가 1차 검수하고, GPT가 PC·모바일 포함 2차 독립검수한 뒤 교차 결과를 보고한다.
- 비밀·복구: 초대 코드·쿠키·비밀값은 기록하지 않는다. 이 스냅샷 변경 전 원문은 GPT 관리 백업에 보존했다.

---
# 써보니 — STATUS (Claude → Codex 인계)

작성: Claude Code · 2026-09-26
범위: Gate 0 (P0)만. Payment/Transaction/TrialPolicy 등은 의도적으로 미구현.
근거 문서: `써보니_Codex_개발_마스터기획_v1.1.md` §60(DB 엔티티), §78(Gate 시스템), §101(MVP 완료 정의)

## 왜 Gate 0만인가
§101 "Validation MVP는 실제 결제·정산·발송을 발생시키지 않는다"에 따라, Gate 2(PG사 서면답변·법률검토 완료) 전까지는
결제·거래 FSM을 만들지 않기로 했습니다. 지금 이 커밋들은 §78 Gate 0(P0) 범위 — 회원, 상품등록,
리스트/검색/상세, 찜, 찾는상품(수요), 시장검증 이벤트 — 만 구현한 상태입니다.

## 스택 결정
- Next.js 16 (App Router, TypeScript, Turbopack)
- **Prisma 대신 Drizzle ORM + better-sqlite3**로 결정함 (`prisma@8.0.0-rc.17`가 alchemy/cloudflare
  workerd/aws-sdk/octokit 등 로컬 SQLite 개발에 불필요한 초대형 의존성을 끌어와서 전환)
- DB 파일: `app/dev.db` (SQLite, git 추적 제외)

## 완료된 파일
- `app/src/db/schema.ts` — 10개 테이블 (users, seller_profiles, buyer_profiles, categories,
  product_models, listings, listing_components, wishlists, demand_intents, market_validation_events)
- `app/src/db/client.ts`, `app/drizzle.config.ts`, `app/drizzle/0000_fat_princess_powerful.sql`
- `app/src/db/seed.ts` — 노트북 3모델 시드 (MacBook Air M2 13", LG gram 16, Galaxy Book3 Pro)
- `app/src/lib/session.ts` — **임시 로그인 스텁**(닉네임만으로 사용자 식별, 쿠키 세션). 실명·휴대폰
  인증(identity_verified/phone_verified)은 미구현 — Gate1/2 이후 실제 인증 붙일 자리만 스키마에 있음
- API: `POST/GET /api/session`, `GET/POST /api/listings`, `GET /api/listings/[id]`,
  `GET /api/models`, `GET/POST /api/wishlists`, `GET/POST /api/demand-intents`
- 화면: `/` (검색+리스트), `/login`, `/listings/new`, `/listings/[id]`, `/demand`

## 검증한 것 (실제 호출 경로 기준, fixture 아님)
`npm run dev`로 로컬 서버 기동 후 curl로 실제 확인:
1. `POST /api/session {"nickname":"tester1"}` → 200, 유저 생성 확인
2. `GET /api/models` → 노트북 3종 정상 반환
3. `POST /api/listings` (MacBook Air 모델로 실제 등록) → 201, listing 생성 확인
4. `GET /api/listings` → 방금 등록한 상품이 리스트에 노출됨
5. `GET /api/listings/[id]` → 상세 정상 반환 + market_validation_events에 VIEW_LISTING 기록됨
6. `POST /api/wishlists` → 찜 토글 정상 (wished: true)
7. `GET /` (홈, 서버 컴포넌트) → 200, DB 조회 결과 실제 렌더링 확인
8. `npx tsc --noEmit` → 오류 0건

## 아직 안 한 것 / Codex가 이어서 할 것
- **인증**: 지금 로그인은 검증용 스텁입니다. 실명/휴대폰 인증은 Gate1/2 논의 후 결정
- **입력값 검증**: 서버 API가 최소한의 null 체크만 함. XSS/길이 제한/가격 음수 등 방어 로직 없음
- **UI 다듬기**: 인라인 style만 사용, 디자인 시스템 없음. 프로덕션 감이 아니라 검증용 뼈대
- **listing_components (구성품 체크리스트)**: 스키마만 있고 등록 폼에서 입력 못 받음
- **찾는 상품 → 매물 알림 연결**: demand_intents는 쌓이지만 매칭 알림 로직 없음 (P0 범위 밖일 수도 있음, 확인 필요)
- **GitHub 원격 저장소**: 아직 로컬 git만 있고 origin 미연결. 저장소명/공개여부 확정 필요

## 절대 건드리면 안 되는 것
- Payment/Refund/Settlement/SettlementHold/Chargeback/Transaction/TrialPolicy/ConditionSnapshot/Dispute
  엔티티 — Gate 2 승인(§78) 전까지 추가 금지
- `listings.trialEnabled`은 코드 레벨에서 항상 false로 강제되어 있음 — 이 강제를 풀지 말 것
