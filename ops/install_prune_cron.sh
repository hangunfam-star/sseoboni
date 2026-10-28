#!/usr/bin/env bash
# 운영 서버에 "매일 04:30 운영 DB 백업 30일 정리" 예약 작업을 설치·제거한다(Codex 2차 지적: 배포가 없어도 30일 상한을 지킴).
# 설치는 사용자 승인 뒤에만 한다(처음 실행 때 30일 넘은 백업이 지워짐 — 영구 삭제).
# 실행 안전(잠금·실행 중 표시·지난 실행 미완료 알림·세 줄 로그·종료 코드)은 ops/prune_cron_run.sh가 맡는다(Codex 3차 지적).
# 사용(서버에서): bash install_prune_cron.sh show | apply | remove
# 환경: CRON_FILE(기본 /etc/cron.d/sseoboni-backup-prune), BASE(기본 /opt/sseoboni). 시험은 이 둘을 바꿔 쓴다.
# return: show는 설치될 줄 출력, apply는 파일 생성 후 0(필요한 스크립트가 없으면 1), remove는 파일 삭제 후 0
set -euo pipefail
CRON_FILE="${CRON_FILE:-/etc/cron.d/sseoboni-backup-prune}"
BASE="${BASE:-/opt/sseoboni}"
LINE="30 4 * * * root BASE=$BASE bash $BASE/ops/prune_cron_run.sh"
case "${1:-show}" in
  show) echo "$LINE" ;;
  apply) for f in backup_prune.sh prune_cron_run.sh; do [ -f "$BASE/ops/$f" ] || { echo "$BASE/ops/$f가 없어요(ops/deploy.sh로 먼저 보내세요)"; exit 1; }; done
         printf '# 써보니 운영 DB 백업 30일 정리(ops/install_prune_cron.sh로 설치)\nSHELL=/bin/bash\n%s\n' "$LINE" > "$CRON_FILE"; chmod 644 "$CRON_FILE"; echo "installed $CRON_FILE" ;;
  remove) rm -f "$CRON_FILE"; echo "removed $CRON_FILE" ;;
  *) echo "show | apply | remove"; exit 2 ;;
esac
