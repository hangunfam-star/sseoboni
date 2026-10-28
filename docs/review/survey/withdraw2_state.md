# 공유 상태 지도(표·파일 읽기/쓰기)

루트: app/src · 표/파일 24개. SQL 문자열과 파일 열기 호출을 글자 규칙으로 읽은 것이라 동적으로 조립된 표 이름은 빠질 수 있다(빠진 표는 계획서 "확인하지 않은 것"에 쓴다). 두 곳 이상에서 쓰는 표는 새 채널이 같이 쓰는지 판단을 쓴다.

조사 범위 대장: E:\PROJECTS\04_써보니\docs\review\survey\withdraw2_state.md.manifest.json sha256:a7401ba18107e0f808a595b8a329c504069d68ffbbbe2bc80ef83faafc974850
대장 결과: ok · 읽음 91 · 제외 묶음 3개(77파일) · 오류 0 · git 누락 0 · 열거 168(재집계 168) · git 저장소 아님(git 대조 생략)

| ID | 표/파일 | 읽는 파일(수) | 쓰는 파일(수) | 쓰는 파일 목록 | 두 곳 이상에서 씀 |
|---|---|---|---|---|---|
| S001 | answered | 1 | 0 |  | 아니오 |
| S002 | better | 1 | 0 |  | 아니오 |
| S003 | categories | 3 | 0 |  | 아니오 |
| S004 | chat_messages | 2 | 0 |  | 아니오 |
| S005 | chat_threads | 2 | 0 |  | 아니오 |
| S006 | demand_intents | 2 | 0 |  | 아니오 |
| S007 | disputes | 2 | 0 |  | 아니오 |
| S008 | drizzle | 44 | 0 |  | 아니오 |
| S009 | listing_photos | 2 | 0 |  | 아니오 |
| S010 | listing_trial_terms | 2 | 0 |  | 아니오 |
| S011 | listings | 4 | 0 |  | 아니오 |
| S012 | market_validation_events | 5 | 0 |  | 아니오 |
| S013 | next | 47 | 0 |  | 아니오 |
| S014 | node | 18 | 0 |  | 아니오 |
| S015 | notifications | 1 | 0 |  | 아니오 |
| S016 | orders | 3 | 0 |  | 아니오 |
| S017 | product_models | 2 | 0 |  | 아니오 |
| S018 | push_subscriptions | 1 | 0 |  | 아니오 |
| S019 | reviews | 2 | 0 |  | 아니오 |
| S020 | sharp | 2 | 0 |  | 아니오 |
| S021 | trial_proposals | 1 | 0 |  | 아니오 |
| S022 | users | 1 | 0 |  | 아니오 |
| S023 | web | 1 | 0 |  | 아니오 |
| S024 | wishlists | 2 | 0 |  | 아니오 |

## 제외 묶음 (계획서가 묶음마다 판단: 제외타당/재조사)

| ID | 종류 | 묶음(폴더/확장자) | 파일 수 | 대표 예시 |
|---|---|---|---|---|
| X001 | 확장자 대상 밖 | .css | 1 | app/globals.css |
| X002 | 확장자 대상 밖 | .png | 2 | app/apple-icon.png, app/icon.png |
| X003 | 확장자 대상 밖 | .tsx | 74 | app/layout.tsx, app/page.tsx, app/admin/AdminControls.tsx |
생성표 해시: e22ca4b7ce4fc4eea194ee0d543d5b82b8894933571b962af3451a56a13f663f
