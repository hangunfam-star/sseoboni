# 써보니 Gate 0 — 2차 독립 검수 요청서 v1.2 (GPT/Codex)

작성: Claude Code(개발·개발자 1차 검증) · 2026-10-08
대상 브랜치: `gate0/market-ui` (이 요청서와 함께 커밋된 HEAD)
검수자 권한: 제품 코드 수정 금지. 판정·결함 기록·보고만 한다(정본 `E:\PROJECT_CONTROL_CENTER\00_공통\PROJECT_WORK_RULES.md` §12).

## 1. 이번 검수 범위
마스터 기획서 §78 Gate 0 / §98 P0 중 2026-10-08 보고서(`reports/2026-10-08-remaining-work.md`)의 미개발 5건과 추가 2건.

| ID | 기능 | 주요 파일 |
|---|---|---|
| N-01 | 구성품 입력(등록·수정), 상세에 구성품 이름 표시 | `src/components/ComponentPicker.tsx`, `src/lib/models.ts`, `src/app/api/listings/route.ts`, `src/app/listings/[id]/page.tsx` |
| N-02 | 등록 후 수정(제목·가격·상태·설명·구성품·써보기 의향), 사진 추가·삭제 | `src/app/listings/[id]/edit/page.tsx`, `src/app/api/listings/[id]/route.ts`, `src/app/api/listings/[id]/photos/route.ts`, `src/lib/photos.ts` |
| N-03 | 찾는 상품 직접 입력(판매와 같은 모델 묶기 규칙) | `src/app/demand/DemandForm.tsx`, `src/app/api/demand-intents/route.ts` |
| N-04 | 목록 나누기(20개씩, 더 보기; 최신·찜 많은 순·검색) | `src/lib/queries.ts`, `src/app/page.tsx` |
| N-05 | 운영자 결과 화면(키 입장, 요약·종류별·상품별·의견, CSV) | `src/app/admin/*`, `src/lib/admin.ts`, `src/lib/admin-metrics.ts`, `src/app/api/admin/*` |
| N-06 | 의견 보내기(망설인 이유·써보기 의향, 연락처 미수집) | `src/app/feedback/page.tsx`, `src/app/api/feedback/route.ts`, `src/ui/feedback.ts` |
| N-07 | 써보기 강조·홈 스토리 영상(직전 커밋 3e2d071) | `src/components/HomeStory.tsx`, `public/hero/story.mp4` |

범위 밖(정책 결정 전): 써보기 비용 공개 화면(§101-3·4), GO/MODIFY/STOP 판정 기준. 화면에는 "판정 보류"로만 표시한다.

## 2. 실행 방법(로컬 격리 — 운영 DB 금지)
1. `app/dev.db`를 읽기 전용으로 복사한다. 예: `python -c "import sqlite3;s=sqlite3.connect('file:app/dev.db?mode=ro',uri=True);d=sqlite3.connect('<복사경로>');s.backup(d)"`
2. `app` 폴더에서 `DATABASE_URL=file:<복사경로> npx next dev -p 3200` (3000번 서버는 사용자 테스트 서버이므로 건드리지 않는다).
3. 운영자 키 위치: `app/.env`의 `ADMIN_KEY` (값을 보고서에 적지 않는다).
4. 시험 중 올린 사진은 `app/runtime-data/uploads`에 저장되므로, 시험 전 파일 목록을 기록하고 끝나면 새로 생긴 파일만 지운다.

## 3. 실제 브라우저 구동 시험(필수)
Playwright 또는 실제 브라우저에서 **클릭·입력**으로 수행한다. 서버 직접 호출·코드 대조는 보조 증거이며 PASS 근거가 아니다.
폭: **PC 1280px**, **모바일 375px** 둘 다 수행한다.
스크린샷 저장 경로: `E:\PROJECTS\04_써보니\검수화면_2026-10-08_v1.2\` (PC는 `pc_`, 모바일은 `m_` 접두어).

| # | 시나리오(클릭·입력 절차) | 기대 결과 |
|---|---|---|
| B-01 | 시작 화면에서 닉네임 입력 → 시작 | 홈으로 이동, 영상 재생, 자막이 장면마다 바뀜, 멈춤 버튼 동작 |
| B-02 | 판매하기 → 사진 2장 → 모델 "목록에 없어요·직접 입력" → 종류·브랜드·모델명 → 제목·가격 → 구성품 칩 2개 + 직접 추가 1개 → "괜찮아요" → 등록 | 상세로 이동, 구성품 이름 4개 표시, "판매자가 써보기를 허용했어요" 표시 |
| B-03 | 상세 하단 "수정" → 사진 1장 추가 → 사진 1장 × (확인 창 승인) → 가격 변경 → 구성품 하나 해제 → 저장 | 상세에 바뀐 가격·구성품 반영, 사진 수 일치 |
| B-04 | 다른 닉네임 계정으로 B-02 상품의 `/listings/<id>/edit` 직접 열기 | "내가 올린 상품만 고칠 수 있어요." 표시, 저장 불가 |
| B-05 | 찾는 상품 → 직접 입력(종류·브랜드·모델명) → 남기기, 같은 모델명을 대소문자만 바꿔 다시 남기기 | 두 번째도 같은 모델로 묶임(모델 목록에 1개) |
| B-06 | 상품이 21개 이상인 상태에서 홈 → "더 보기" | 첫 화면 20개, 더 보기 후 나머지 표시; 찜 많은 순·검색에서도 같은 동작 |
| B-07 | 홈 미션 카드 "망설여진다면 이유를 알려 주세요" → 이유·의향 선택 → 의견 입력 → 보내기 | "의견을 받았어요" 표시; 연락처 입력칸 없음 |
| B-08 | `/admin` → 틀린 키 → 맞는 키 | 틀린 키 거부, 맞는 키로 요약·종류별(판정 보류)·상품별·의견 표시, 하단 메뉴 없음, 화면 가로 넘침 없음 |
| B-09 | 운영자 화면 "전체 기록 CSV 내려받기" | CSV 다운로드, 첫 줄 머리글, 엑셀에서 한글 정상 |
| B-10 | 로그아웃 상태에서 `/api/admin/export` 열기 | 401 |
| B-11 | 모든 화면 375px에서 확인 | 글자 잘림·겹침·가로 넘침 없음, 터치 영역 44px 이상 |

## 4. 코드 검수 관점
- 권한: 수정·사진 삭제·운영자 화면·CSV가 소유자/운영자만 가능한가(`sellerId !== userId`, `isAdmin()`).
- 데이터 진실성: 숫자는 중복 제거한 실제 값인가, 3명 미만 수요·써보기 숫자를 숨기는가, 판정 칸이 근거 없이 GO/STOP을 내지 않는가.
- Gate 2 가드: `trialEnabled`가 어디서도 true가 되지 않는가, 결제·거래 엔티티가 없는가.
- 보안: 운영자 키 비교가 timingSafeEqual인가, 쿠키 httpOnly·서명, CSV 수식 주입 방지, 사진 파일명 검증·경로 이탈 방지.
- 개인정보: 의견에 연락처를 받지 않는가, 사진 EXIF/GPS 제거 유지.

## 5. 개발자 1차 검증 결과(Claude, 참고용 — 검수 판정 근거 아님)
- `npx tsc --noEmit` 오류 0, `npx eslint src` 오류 0, `npm run test:ui` 21/21 통과.
- 격리 서버(3200, 복사 DB)에서 Playwright 클릭·입력 시험 34/34 통과(B-02~B-11 해당 항목). 캡처: `앱화면_2026-10-08_v1.1/미개발완료/`.
- 공개 링크(ngrok → 3000) 모바일·PC 스모크: `/`, `/feedback`, `/demand`, `/admin` 200, 운영자 입장·CSV 200, 가로 넘침 없음.
- 시험 데이터: 복사 DB만 사용 후 삭제, 시험 사진 4장 삭제(운영 DB 참조 0 확인).

## 6. 보고 형식
결함마다 ID·심각도(차단/P1/P2)·재현 절차·기대/실제·스크린샷 경로. 최종 판정: PASS / PASS WITH NOTES / FAIL. 결과 파일: `CODEX_REVIEW_RESULT_GATE0_v1.2.md`.
