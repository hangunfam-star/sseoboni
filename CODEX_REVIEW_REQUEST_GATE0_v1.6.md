# Codex 재검수 요청서 v1.6 — v1.5 지적 수정분 (2026-10-15, Claude)

## 배경
Codex 독립 검수 v1.5(`CODEX_REVIEW_RESULT_GATE0_v1.5.md`) 판정 FAIL, 지적 3건. 모두 고쳤다. 운영 배포는 이 재검수 통과 뒤에 한다(아직 배포 안 함).

## 고친 것

| v1.5 지적 | 고친 내용 | 파일 |
|---|---|---|
| 결함 1: 시험용 상품 비용 조회가 시장검증 기록에 섞임 | `/api/trial-cost`가 시험용 상품이면 VIEW·STILL_TRY·DECLINE 모두 409. 같은 종류 빈틈도 함께 막음: 찜 넣기·빼기, 공유, 채팅 시작, 채팅 메시지는 동작은 그대로 두고 시험용 상품이면 시장검증 기록만 남기지 않음 | `app/src/app/api/trial-cost/route.ts`, `app/src/app/api/wishlists/route.ts`, `app/src/app/api/listings/[id]/share/route.ts`, `app/src/app/api/chats/route.ts`, `app/src/app/api/chats/[id]/route.ts` |
| 결함 2: 예전 카카오 시험이 닉네임 정책과 안 맞음 | MY 닉네임 바꾸기 6개 기대를 "버튼 없음·정한 닉네임 표시·API 403·DB 그대로" 4개로 바꿈. 머리말에 이 시험만 NICK=0이라고 적음 | `ops/e2e/legacy/test_kakao_only.py` |
| 결함 3: 파일 끝 빈 줄 | 삭제, `git diff --check` 통과 | `app/src/app/me/MyActions.tsx` |
| 회귀 시험 추가 | 비용 조회 3행동 409, 찜·공유·채팅 동작 + 기록 수 그대로 | `ops/e2e/suites/test_test_listings.py` |

## Claude 자체 시험(2026-10-15)
- 격리 서버(운영과 같은 순서: 예전 방식 [시험용] 10개 → 새 도구로 is_test 변환) `test_test_listings.py` 20/20
- `test_kakao_only.py`(NICK=0) 29/29
- 단위 45/45, `git diff --check` 통과, tsc·eslint 오류 없음

## 재검수 범위
- 커밋: 이 요청서가 들어간 커밋(아래 "범위 커밋")만. 그 앞(13e564c까지)은 v1.5에서 검수 완료.
- 확인할 것
  1. 결함 1~3이 실제로 고쳐졌는지(직접 API 호출로 기록 수 비교 포함).
  2. 찜·공유·채팅이 시험용 상품에서도 정상 동작하는지(기록만 빠지고 기능은 그대로), 일반 상품에서는 기록이 계속 남는지.
  3. 휴대폰 375px·PC 1280px 실제 브라우저: 시험용 상품 상세에서 찜·공유·채팅 클릭.
- 결과 파일: `CODEX_REVIEW_RESULT_GATE0_v1.6.md`

## 범위 커밋
이 파일이 처음 들어간 커밋(`git log --oneline -1 -- CODEX_REVIEW_REQUEST_GATE0_v1.6.md`).
