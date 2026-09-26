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
