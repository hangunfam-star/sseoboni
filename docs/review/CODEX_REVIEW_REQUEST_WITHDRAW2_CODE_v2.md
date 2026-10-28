프로젝트: 써보니 · 작성자: Claude Code
요청서 번호: REQ-써보니-20261028-2229 · 작성 일시: 2026-10-28 22:29:10 KST
기준 지시: 2026-10-28 22:2x 사용자 "권장안으로 진행"(배포 전 할 일, 보관 백업 세트 7개 유지) · 버전: v2(탈퇴 2단계 코드 다시 검수 요청) (이전 v1(첫 코드 검수 요청)) · 이전 버전과 같은지: 일부 다름
일의 크기: 대 — 운영 DB 트리거·표 추가, 거래 기록 이동·파기 코드
왕복: 2/3 · 막는 문제 이전 6건 → 지금 0건(반영 기준)

# 탈퇴 2단계 코드 다시 검수 요청 (2/3)

## 역할·금지
읽기 전용 코드 검수. 78절(Codex·Claude 직접 주고받기)로 scripts/codex_ask.sh가 직접 전달한다. 매칭 확인은 머리말 한 줄, "진행" 승인을 기다리지 말고 같은 답변에서 끝내라.
코드·DB·파일·git 변경, 운영 서버 접속, 시뮬레이션 DB 쓰기 금지. 시험은 `& E:\PROJECTS\_work\04_써보니\withdraw2_test\run_unit.ps1`(사본만 씀)만 실행 가능.

## 이전 결과와 처리
1차 결과: docs/review/CODEX_REVIEW_RESULT_WITHDRAW2_CODE_v1.raw.txt 128~146행.
| 1차 차단 | 처리(파일) | 새 시험(ops/e2e/suites/withdraw2_unit.ts) |
|---|---|---|
| 잠금 시각 고정 | retain.ts retainClock, acquireRetainLock·beforeFileOp가 매번 실제 시각, 기한 지나면 FenceLost | 검수1 3개 |
| 파기 후보 임의 선택 | retain.ts sharedCand: 진행 중 키 전부 뺀 후보 하나, 모든 진행 줄 한 트랜잭션 갱신 | 검수2 |
| Next 이미지 캐시 | SafePhoto.tsx·PhotoGallery.tsx unoptimized, next.config.ts minimumCacheTTL 0 | 검수3 + 화면 시험 "사진 주소에 /_next/image 없음" PC·모바일 |
| 전체 롤백 기록 대상 | 0019_down_full.sql은 0019 created_at만, withdraw2_rollback.cjs가 새 마이그레이션 있으면 거절 | 검수4 2개 |
| 롤백 경쟁 | withdraw2_rollback.cjs: 두 DB BEGIN EXCLUSIVE 뒤 재검사·DDL | 검수5 2개 |
| 백업 운영 연결 | jobs.ts retainBackup 단계(dailyRetainedBackup, 24시간), deploy.sh에 PRUNE_BACKUPS=1일 때만 backup_prune.sh(기본 꺼짐) | 검수6 |
| 참고 1 commit 실패 400 | 사진 라우트 2곳: DB 줄 뒤 commit 실패는 201(정기 정리가 마무리) | — |
| 사용자 결정 추가 | retain.ts KEEP_SETS=7, pruneOldSets(파기 후보 세트는 남김) | "보관 세트 7개 유지" 2개 |
| 시험 중 발견 | withdraw.ts cleanupOrphans: next dev(NODE_ENV=development)에서는 업로드 폴더 정리 안 함(이 PC는 여러 시험 DB가 사진 폴더 공유) | 단위 T31b는 tsx라 그대로 실행 |

## Claude 실제 실행 결과
| 시험 | 결과 |
|---|---|
| 단위 withdraw2_unit.ts | 129 통과 / 0 실패 (E:\PROJECTS\_work\04_써보니\withdraw2_test\unit2.log) |
| tsc --noEmit | 오류 0 |
| 새 화면 시험 PC 1280 / 모바일 375(UA·터치) | 12/0, 12/0 (ops/e2e/.out/withdraw2_screen.log, shots/w2_*) |
| 1단계 탈퇴 모바일 | 58/0 |
| 기존 기능 회귀 | 105/0 (ops/e2e/.out/regress_withdraw.log) |

## 검수 대상
1차 목록 + app/drizzle/meta/0019_snapshot.json + ops/deploy.sh + app/src/components/SafePhoto.tsx·PhotoGallery.tsx.

## 판정 기준 (93절(개발 전 의견 보고 후 진행) 4항)
차단 오류(실행 불가·데이터 손상/손실·지워야 할 개인정보 잔류·보안·되돌릴 수 없는 결과)만 막고 근거 파일:행·고칠 방법. 나머지는 참고사항 표. 새 지적은 ⓐ안 풀림 ⓑ수정 때문에 생김 ⓒ처음에 놓침으로 나누고 ⓒ는 같은 유형을 한 번에 전부(63절(검수 왕복 3번)).

## 보고 형식
머리말(대응 요청서: REQ-써보니-20261028-2229) → 판정 → 1차 6건 풀림 표 → 새 차단 표 → 참고사항 표 → 확인하지 않은 것.
