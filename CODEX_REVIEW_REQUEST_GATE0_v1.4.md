# 써보니 Gate 0 검수 요청 v1.4 — 정식 서버·카카오 로그인·계정 복구·알림(웹 푸시)·홈 화면 추가·메인 개편 (2026-10-14)

- 요청: 사용자 지시 "코덱스 검수 요청서 작성 후 보고"
- 저장소: `E:\PROJECTS\04_써보니`
- 브랜치: `gate0/market-ui` (main도 2cb5d0f까지 같은 내용으로 병합됨)
- 검수 범위: 커밋 `2379afe..d125599`(최신 `d125599`, 19개)
- 역할: Codex는 독립 검수만 한다(제품 코드는 수정하지 않음). 결과는 `CODEX_REVIEW_RESULT_GATE0_v1.4.md`에 적는다.
- 운영 주소: https://sseoboni.mwwork.co.kr (실제 사용자 데이터 — **읽기 전용 확인만**, 가입·신청·찜 등 쓰기 금지)

## 1. 바뀐 것(검수 대상)
| 영역 | 핵심 파일 |
|---|---|
| 정식 서버(Docker) | `app/Dockerfile`, `app/.dockerignore`, `app/scripts/migrate.cjs`, `app/scripts/redirect-to-mwwork.cjs`(예전 ngrok 주소 → 새 주소 302 + 로그인 이어받기 표) |
| 카카오 로그인 | `app/src/lib/kakao.ts`, `app/src/app/api/auth/kakao/{start,callback,complete,link}/route.ts`, `app/src/app/login/{page.tsx,LoginForm.tsx}`, `app/src/app/me/login/**`, `app/src/components/KakaoButton.tsx`, DB `social_accounts`(0011) |
| 닉네임으로 시작 폐지 | `app/src/app/api/session/route.ts`(새 계정 403, `ALLOW_NICKNAME_LOGIN=1`인 시험 서버만 예외), 화면·서버 문구 39개 파일, MY 닉네임 바꾸기(`app/src/app/me/MyActions.tsx` `NicknameEditor`) |
| 카카오 닉네임 선택 | 콜백에서 카카오 닉네임(동의 시) → 가입 대기 서명 쿠키 `n`, `complete`의 `{ useKakao: true }` |
| 계정 복구 | `app/src/lib/login-link.ts`, `app/src/app/api/admin/login-link`, `app/src/app/api/auth/{login-link,carry}`, `app/src/app/login/link/**`, `app/src/app/admin/LoginLinkButton.tsx`, DB `login_links`(0012, 해시만 저장) |
| 알림 | `app/src/lib/notify.ts`, `app/src/lib/jobs.ts`, `app/src/instrumentation.ts`, `app/src/app/api/notifications/**`, `app/src/app/api/push/route.ts`, `app/src/app/api/admin/jobs/route.ts`, `app/src/app/notifications/**`, `app/src/app/me/notifications/**`, `orders.ts`의 `systemMessageTx`(거래 안내 17곳 → 상대에게 알림), 채팅·찜·상품·제안 라우트, DB `notifications`·`push_subscriptions`·`notification_prefs`(0013) |
| 웹 푸시·홈 화면 추가 | `app/public/sw.js`, `app/src/app/manifest.ts`, `app/src/ui/pwa.ts`, `app/src/components/InstallPrompt.tsx`, `app/src/app/layout.tsx`(beforeinstallprompt 미리 받기), VAPID 키(.env) |
| 아이콘·로고 | `app/public/icons/*`, `app/src/app/{icon,apple-icon}.png`, `.wordmark::before`, 로딩 화면 마스코트, 기본 공유 그림(`layout.tsx` openGraph) |
| 메인 개편 | 베타테스터 미션 닫기·열기(`MissionCard.tsx`), 비교 그림 블록(`CompareBlock.tsx`, `public/compare/*`), 써보기 이야기 미리보기(`DemoTrialStories.tsx`, `content/demo-trial.ts`, `Slider.tsx`), 브랜드 7개(`app/src/app/page.tsx`) |

## 2. 고정된 결정(사용자)
1. 로그인은 카카오만. 처음 온 사람은 카카오 로그인 뒤 **카카오 닉네임 그대로 쓰기 / 써보니 닉네임 만들기** 중 고른다. 닉네임은 MY에서 바꿀 수 있다.
2. 카카오에서는 회원번호와(동의 시) 닉네임만 받는다. 이름·연락처·이메일은 받지 않는다.
3. 계정 복구는 운영자 1회용 링크(24시간, 버튼을 눌러야 사용 — 카카오톡 미리보기 로봇이 열어도 소모되지 않게).
4. 거래 알림은 끌 수 없다. 채팅·관심·후기는 끌 수 있고, 밤 10시~아침 8시(한국 시간)에는 거래 외 휴대폰 알림을 아침으로 미룬다.
5. 메인 "써보니는 이렇게 쌓여요"는 미리보기 데이터(지어낸 숫자·후기). 블록·카드별 표시는 없애고 섹션 맨 위 "써보니가 열리면 이렇게 보여요 · 미리보기 화면" 한 줄만 둔다(**이 한 줄은 법적 고지라 지우면 안 됨**). 실제 써보기 완료 30건부터 자동으로 숨긴다.
6. 거래 열림(tradeOpen=true), 실제 수수료 0%(정식 3%는 기록만).

## 3. 이미 한 검증(참고, Claude 개발자 검증)
- 단위 45/45, 거래 전체 76/76(격리, 닉네임 계정 허용 시험 서버)
- 카카오 로그인(가짜 카카오 서버) 26+26, 카카오만 29/29, 닉네임 선택 17/17
- 계정 복구 27+27, 알림 51+51(가짜 푸시 서버가 받은 알림을 기기 키로 복호화해 내용 확인), 써보기 이야기 41/41, 비교 블록 11/11, 미션 카드 13/13, 로고 11/11
- 실제 사이트 읽기 전용: 카카오만 9/9, 비교 블록 11/11, 써보기 이야기 9/9, 알림·설치 안내 8/8
- 시험 스크립트: `C:\Temp\claude\E--PROJECTS-04----\7eb1f6e0-b5b6-4f06-ac1d-bac1a8a43430\scratchpad\`(`kakao\`, `recover\`, `notify\`, `demo\`, `e2e\trade_e2e.py`), 가짜 카카오 `kakao\fake_kakao.py`(3299), 가짜 푸시 `notify\fake_push.cjs`(3299)
- 미확인: 실제 휴대폰 웹 푸시 수신(아이폰·안드로이드), 카카오톡 안 "기본 브라우저로 열기"

## 4. 코드 검수 요청(실제 결함만)
- **인증·세션:** 카카오 state 위조·재사용, 가입 대기 쿠키 위조·만료, 외부 주소 `next` 차단, 남의 카카오 연결·한 계정 두 카카오, 연결 해제 후 상태, `/api/session` 새 계정 차단 우회, `ALLOW_NICKNAME_LOGIN`이 운영에서 켜질 수 있는 경로
- **카카오 닉네임:** 동의 안 함·빈 값·12자 초과·특수문자 처리, `useKakao`로 다른 닉네임 주입 가능성
- **계정 복구:** 링크 원문 저장 여부, 동시 사용·재사용, 만료, 미리보기 로봇이 GET만으로 소모하지 않는지, carry 표(2분·1회) 재사용·위조, 예전 주소 이동 서버의 쿠키 검증
- **알림:** 상대에게만 가는지(자기 행동 알림 없음), 중복 키로 한 번만, 채팅 5분 묶음, 설정 끔 반영, 밤 시간 미룸(KST 경계), 읽음 처리 권한(남의 알림), 푸시 구독 남의 endpoint 덮어쓰기, 410·연속 실패 삭제, 발송이 거래 트랜잭션을 막지 않는지, 정기 작업 중복 실행
- **개인정보:** 알림 문구·푸시 내용에 계좌·주소 등 민감정보가 들어가지 않는지
- **메인:** 미리보기 고지 한 줄이 항상 보이는지, 실제 30건 기준 전환, 슬라이드 접근성(키보드·화면 읽기)
- **마이그레이션:** 0011~0013(기존 DB에 적용 시 문제)
- **Docker·배포:** 이미지에 비밀값·DB가 들어가지 않는지(.dockerignore)

결함마다: 파일:줄, 실패 상황, 심각도(높음·중간·낮음), 수정 방법.

## 5. 실제 브라우저 구동 시험(필수)
- **시험 주소:** 격리 서버만 쓴다. 운영 주소(https://sseoboni.mwwork.co.kr)에서는 화면 열기·버튼 모양 확인 같은 **읽기만** 하고 가입·신청·찜·채팅 등 쓰기는 하지 않는다.
- **격리 서버 띄우기:**
  1. `app/dev.db`를 백업 방식으로 복사 DB에 떠 놓고 `node app/scripts/migrate.cjs <복사DB>`로 마이그레이션한다.
  2. `{"tradeOpen": true}` 설정 파일을 만든다.
  3. 가짜 카카오 서버: `python scratchpad\kakao\fake_kakao.py 3299` (`/_set?id=1001&nick=카톡이름`으로 다음 로그인할 회원·닉네임 지정)
  4. `set DATABASE_URL=file:<복사DB>&& set TRADE_SETTINGS_FILE=<설정파일>&& set KAKAO_REST_KEY=testkey&& set KAKAO_CLIENT_SECRET=testsecret&& set KAKAO_AUTH_BASE=http://localhost:3299&& set KAKAO_API_BASE=http://localhost:3299&& npx next dev -p 3200`
  5. 알림 발송 시험이 필요하면 가짜 카카오 대신 `node scratchpad\notify\fake_push.cjs app` (같은 3299 포트이므로 따로 띄운다).
- **계정:** 카카오(가짜) 로그인으로 만든다. 운영자 키는 `app/.env`의 `ADMIN_KEY`(값은 보고서에 적지 않음).
- **폭:** PC 1280px, 모바일 375px 모두.
- **시나리오(클릭·입력, 기대 결과)**
  1. 시작 화면: 카카오 버튼만 있고 닉네임 입력칸 없음 → 카카오(닉네임 있음) → "카카오 닉네임 그대로 쓰기"(기본 선택) → 시작 → 그 닉네임으로 가입
  2. 카카오(닉네임 있음) → "써보니 닉네임 새로 만들기" → 빈 칸 오류 → 다시 "그대로 쓰기" 누르면 입력칸 숨김 → 새로 만들기·입력·Enter → 그 닉네임으로 가입
  3. 카카오 닉네임이 12자 넘거나 없음 → 선택지 없이 입력칸만
  4. MY: 닉네임 바꾸기 → Esc·취소로 닫힘 → 1글자 오류 → 저장·Enter로 바뀜
  5. 로그아웃 → 카카오로 다시 로그인 → 닉네임 단계 없이 같은 계정
  6. 로그인 전: MY·찜·채팅·내 거래·알림 화면 "카카오로 로그인" 안내, 상품 상세 찜 누르면 카카오 로그인 안내
  7. MY → 로그인 연결 → 연결 해제(취소·확인) → 다시 연결, 남의 카카오 연결 거부
  8. 운영자 화면 "계정 · 로그인 복구" → 복구 링크 만들기·복사·새로 만들기(취소·확인) → 다른 창에서 링크 열기 → 버튼으로 들어가기 → 같은 링크 재사용 거부
  9. 알림: 거래 신청 → 판매자 종 배지·알림함 → 누르면 거래 화면·읽음 → 채팅 두 번 → 알림 하나 → 채팅방 열면 읽음 → 모두 읽음
  10. 알림 설정: 스위치 4개 켜고 끄기·새로고침 유지·거래 잠김, 이 기기 알림 켜기/끄기(헤드리스는 권한이 막혀 있으면 BLOCKED로 기록)
  11. 홈 화면 추가 안내(모바일 UA): 안드로이드·아이폰·카카오톡 안 각각 레이어, 다음에 → 7일, 상품 상세·PC에서는 안 뜸
  12. 메인: 미션 카드 × 닫기·접힌 줄로 열기·새로고침 유지, 비교 그림 5장 슬라이드(점·이전·다음), 써보기 이야기 4블록 슬라이드·맨 위 미리보기 고지 한 줄, 브랜드 칩 7개
- **스크린샷 저장:** `앱화면_2026-10-08_v1.1\Codex검수_v1.4\` 아래에 `pc_`·`m_` 접두로 저장한다.
- **시험 데이터:** 복사 DB에만 남긴다. 실제 `app/dev.db`·`app/runtime-data`·운영 서버 DB는 바꾸지 않는다.
- **실행이 막힐 때:** 브라우저 실행이 막히면 BLOCKED와 정확한 원인을 기록한다.

## 6. 판정
PASS 또는 FAIL, 결함 목록, 브라우저 시험 결과(시나리오별 PASS·FAIL·BLOCKED, 스크린샷 경로)
