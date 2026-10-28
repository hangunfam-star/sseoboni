프로젝트: 써보니 · 작성자: Claude Code
요청서 번호: REQ-써보니-20261028-1149 · 작성 일시: 2026-10-28 11:49:33 KST
기준 지시: 2026-10-28 사용자 "권장안"(탈퇴 2단계: L1 법정 보관 적용, 백업 30일) · 버전: v1(탈퇴 2단계 계획 v9 첫 계획 검수 요청) (이전 없음) · 이전 버전과 같은지: 처음
일의 크기: 대 — 운영 DB 트리거·표 추가, 거래 기록 이동·파기, 운영 백업 삭제

# 탈퇴 2단계 계획 검수 요청 (1/3)

## 역할
읽기 전용 계획 검수. 코드·DB·파일·git을 바꾸지 마라. 운영 서버에 접속하지 마라. 시뮬레이션 서버(localhost:3200)에 탈퇴 POST를 보내지 마라.

## 읽을 것
1. docs/review/WITHDRAW_PLAN_v9.md (대상)
2. docs/review/SELF_REVIEW_WITHDRAW_PLAN_v9.md (자체 적대 검토 결과와 반영)
3. 네 개발 전 의견: docs/review/CODEX_OPINION_RESULT_WITHDRAW_STAGE2_v1.raw.txt
4. 1단계 코드: app/src/lib/withdraw.ts, app/src/app/api/me/withdraw/route.ts, app/src/lib/notify.ts, app/src/lib/jobs.ts, app/src/lib/orders.ts, app/src/lib/photos.ts, app/src/db/schema.ts
5. 쓰기 호출 실측 목록: docs/review/survey/withdraw2_write_calls.txt

## 판정 기준 (93절(개발 전 의견 보고 후 진행) 4항)
- **차단 오류**만 막는다: 이대로 개발하면 실행 불가, 데이터 손상·손실(법정 보관값 손실 포함), 보안 사고, 되돌릴 수 없는 결과가 생기는 것. 근거 파일:행과 고칠 방법을 함께 쓴다.
- 그 밖의 지적(개선·문구·가능성)은 **참고사항** 표(항목·영향·권장 시점)로 따로 쓴다. 참고사항은 합격/불합격에 넣지 않는다.

## 특히 볼 것
1. 2절 보관 이동 상태기계: 단계 사이 종료·동시 실행·두 번째 당사자 탈퇴에서 값 손실·중복·영구 정지가 남는가.
2. 5절 트리거: 탈퇴하지 않은 사용자의 정상 동작을 막는 경로가 있는가(쓰기 호출 목록 기준).
3. 3절 전수표: schema의 개인정보 칸 중 빠진 것.
4. 4절 파기: 운영 DB secure_delete·WAL 정리, 보관 DB journal_mode=DELETE로 잔재가 남지 않는가.
5. 1절 승인 목록과 14절 막힘 대응표가 운영 반영에 충분한가.

## 보고 형식
머리말(프로젝트·작성자·대응 요청서: REQ-써보니-20261028-1149·작성 일시) → 판정(합격/불합격, 차단 오류 수) → 차단 오류 표 → 참고사항 표 → 확인하지 않은 것.
