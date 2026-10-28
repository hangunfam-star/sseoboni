프로젝트: 써보니 · 작성자: Claude Code
요청서 번호: REQ-써보니-20261028-1104 · 작성 2026-10-28 11:04:54 KST
기준 지시: 2026-10-28 사용자 "탈퇴 입구 유지하고 2단계 진행" · 버전 v1(탈퇴 2단계 개발 전 의견 요청) · 이전 버전과 같은지: 해당 없음(최초)
일의 크기: 대

# 탈퇴 2단계 — 개발 전 의견 요청 (93절(개발 전 의견 보고 후 진행) ①)

## 역할
읽기 전용 독립 의견. 코드·DB·파일을 바꾸지 마라. 이것은 계획 검수가 아니라 계획을 쓰기 전 의견이다.

## 지금 상태
- 1단계는 커밋 f25a1d7(브랜치 gate0/market-ui)에 있다. 운영에서는 WITHDRAW_ENABLED가 꺼져 있다.
- 1단계 코드: app/src/lib/withdraw.ts, app/src/app/api/me/withdraw/route.ts, app/src/app/me/account/WithdrawForm.tsx, ops/e2e/suites/test_withdraw.py
- 1단계 계획: docs/review/WITHDRAW_PLAN_v7.md. 2단계 범위: docs/review/WITHDRAW_PLAN_v5.md 10절. 2단계 설계 바탕: docs/review/WITHDRAW_PLAN_v4.md 4~6절·12절, 그 반박 지적 B1~B5·S1~S7(CODEX_REVIEW_RESULT_WITHDRAW_PLAN_v1.raw.txt, SELF_REVIEW_WITHDRAW_PLAN_v3.md)
- 시뮬레이션 서버: http://localhost:3200 (WITHDRAW_ENABLED=1로 켜져 있음). 읽기만 하고 탈퇴 POST는 보내지 마라.

## 답해 줄 것 (쉬운 말, 항목마다 짧게)
1. 만들 것: 2단계에서 꼭 만들어야 하는 것과 빼도 되는 것. 근거는 코드 파일:행.
2. 겹침: 1단계 코드와 v4 설계가 겹치거나 어긋나는 곳(v4는 1단계 전에 쓰였다).
3. 위험: 운영에서 켰을 때 데이터 손상·개인정보 남음·되돌릴 수 없는 결과가 생길 수 있는 곳.
4. 법적 전제: 써보니(개인 간 중고 거래 중개)에 전자상거래법 시행령 제6조 보관 의무가 적용되는지가 설계 크기를 정한다. 적용 여부를 사용자에게 물어야 할 질문 형태로 정리해 달라(단정하지 말고, 근거가 공식 문서면 주소).
5. 실제 사이트 확인: localhost:3200에서 /me, /me/account를 열어(curl 등 읽기 전용) 탈퇴 입구·화면이 v4 완성 정의와 맞는지.
6. 권장안 하나와 이유.

## 금지
파일 쓰기, git 변경, DB 쓰기, 탈퇴 POST, 운영 서버 접속.

## 보고 형식
항목 1~6 순서. 모르는 것은 "모름"이라고 쓰고 이유를 한 줄로.
