프로젝트: 써보니 · 작성자: Claude Code
요청서 번호: REQ-써보니-20261028-2249 · 작성 일시: 2026-10-28 22:49:02 KST
기준 지시: 2026-10-28 22:2x 사용자 "권장안으로 진행" · 버전: v3(탈퇴 2단계 코드 마지막 다시 검수 요청) (이전 v2(2차 요청)) · 이전 버전과 같은지: 일부 다름
일의 크기: 대 — 운영 DB 트리거·표 추가, 거래 기록 이동·파기, 운영 배포 스크립트
왕복: 3/3 · 막는 문제 1차 6건 → 2차 2건 → 지금 0건(반영 기준)

# 탈퇴 2단계 코드 마지막 다시 검수 요청 (3/3)

## 역할·금지
읽기 전용. 78절(Codex·Claude 직접 주고받기)로 scripts/codex_ask.sh가 직접 전달한다. 매칭 확인은 머리말 한 줄, "진행" 승인을 기다리지 말고 같은 답변에서 끝내라. 코드·DB·파일·git 변경, 운영 서버 접속 금지.
시험 실행 허용: `bash ops/e2e/suites/test_deploy_failclosed.sh`(E:\PROJECTS\_work\04_써보니\deploy_test만 씀, 서버 안 씀), `powershell -File E:\PROJECTS\_work\04_써보니\withdraw2_test\run_unit.ps1`(사본만 씀).

## 2차 차단 2건 처리
| 2차 차단 | 처리 | 시험 |
|---|---|---|
| 배포 실패를 성공으로 덮음(같은 유형 전수) | 서버 단계를 새 파일 ops/remote_deploy.sh로 옮김: `set -euo pipefail`, 단계마다 실패 즉시 종료, `curl --fail`, 이미지 정리는 EXIT trap에서 원래 종료 코드를 보존. ops/deploy.sh는 `set -euo pipefail`, HEAD의 remote_deploy.sh·backup_prune.sh를 복사해 ssh로 실행하고 그 종료 코드를 그대로 돌려줌 | ops/e2e/suites/test_deploy_failclosed.sh: 정상, build·사전 백업·백업 정리·마이그레이션·재시작·HTTP 실패 각각, 이미지 정리만 실패, PRUNE 꺼짐 — 9건 |
| 운영 DB 30일 정리 정기 실행 없음 | 새 파일 ops/install_prune_cron.sh(show/apply/remove): 서버 /etc/cron.d에 매일 04:30 backup_prune.sh 실행, 89절(자동 실행 로그 세 줄) 시작·끝 줄을 /opt/sseoboni/backup_prune.log에. 설치는 사용자 승인 뒤(기본 설치 안 함). 운영 이미지에 bash·GNU find 있음(2026-10-28 22:4x 읽기 전용 확인, Debian 11) | 같은 시험 파일: 스크립트 없으면 설치 거절, 설치 줄 내용, 예약 명령을 배포 없이 단독 실행 → 정리 호출·로그 시작/끝 줄, 제거 — 3건 |
| 참고: run_unit.ps1 종료 코드 | 마지막에 `exit $rc` | 프로세스 종료 코드 0 확인 |

## Claude 실제 실행 결과
| 시험 | 결과 |
|---|---|
| test_deploy_failclosed.sh | 12 통과 / 0 실패, 종료 0. 시험 이름이 실패 신호와 겹쳐 생긴 오탐 1건은 시험 쪽을 고쳐 재실행 |
| bash -n deploy.sh / remote_deploy.sh / install_prune_cron.sh | 문법 오류 0 |
| 단위 withdraw2_unit.ts | 129 / 0 (앱 코드는 2차 요청 뒤 바뀌지 않음) |
| 화면 PC·모바일, 회귀 | 2차 요청 때 결과 그대로(앱 코드 변경 없음): 12/0, 12/0, 58/0, 105/0 |

## 검수 대상
ops/deploy.sh, ops/remote_deploy.sh, ops/install_prune_cron.sh, ops/backup_prune.sh, ops/e2e/suites/test_deploy_failclosed.sh. 앱 코드는 2차 대상과 같다(바뀐 것 없음).

## 판정 기준 (93절(개발 전 의견 보고 후 진행) 4항)
차단 오류만 막고 근거 파일:행·고칠 방법. 나머지는 참고사항 표. 새 지적은 ⓐ안 풀림 ⓑ수정 때문에 생김 ⓒ처음에 놓침. 이번이 마지막이다(63절(검수 왕복 3번)): 차단이 남으면 사용자에게 선택지를 올린다.

## 보고 형식
머리말(대응 요청서: REQ-써보니-20261028-2249) → 판정 → 2차 2건 풀림 표 → 새 차단 표 → 참고사항 표 → 확인하지 않은 것.
