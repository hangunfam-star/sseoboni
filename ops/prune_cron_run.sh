#!/usr/bin/env bash
# 매일 예약 작업이 부르는 운영 DB 백업 30일 정리 실행기(ops/install_prune_cron.sh가 설치). Codex 3차 지적: 자동 실행 안전(89절(자동 실행 로그 세 줄)).
# - 한 번에 하나만: mkdir 잠금($BASE/backup_prune.lock.d, pid 기록). 잠금 주인이 살아 있으면 건너뛰고 종료 코드 75
# - 실행 중 표시 파일($BASE/backup_prune.running): 시작 때 만들고 끝 줄을 쓴 뒤에만 지운다. 시작할 때 남아 있으면 "지난 실행이 끝 줄 없이 끝남"을 로그에 남긴다
# - 로그($BASE/backup_prune.log): 시작 줄 → 정리 출력(진행 줄) → 끝 줄(종료 코드). 끝 줄은 EXIT trap에서 쓴다
# 환경: BASE(기본 /opt/sseoboni), PRUNE_CMD(기본: 운영 이미지로 backup_prune.sh 실행 — 시험에서 바꿔 끼움)
# return: 정리 명령의 종료 코드 그대로(성공 0). 다른 실행이 돌고 있으면 75
set -uo pipefail
BASE="${BASE:-/opt/sseoboni}"
LOG="$BASE/backup_prune.log"; RUNNING="$BASE/backup_prune.running"; LOCK="$BASE/backup_prune.lock.d"
PRUNE_CMD="${PRUNE_CMD:-docker run --rm -v $BASE/data:/data -v $BASE/backups:/backups -v $BASE/ops:/ops:ro -e APP_DIR=/app sseoboni:latest bash /ops/backup_prune.sh /backups /data/dev.db}"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
# 잠금: mkdir은 한 번에 한 쪽만 성공한다. 주인 pid가 죽었으면 남은 잠금을 치우고 한 번 더 시도
if ! mkdir "$LOCK" 2>/dev/null; then
  owner="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null; then log "skip backup_prune: 다른 실행이 진행 중(pid=$owner)"; exit 75; fi
  log "note backup_prune: 주인 없는 잠금을 치움(pid=${owner:-없음})"; rm -rf "$LOCK"
  mkdir "$LOCK" 2>/dev/null || { log "skip backup_prune: 잠금을 얻지 못함"; exit 75; }
fi
echo $$ > "$LOCK/pid"
rc=1
# param: 없음. return: 끝 줄을 쓰고 표시 파일·잠금을 지운 뒤 원래 종료 코드로 끝냄
finish() { log "end backup_prune pid=$$ exit=$rc"; rm -f "$RUNNING"; rm -rf "$LOCK"; exit "$rc"; }
trap finish EXIT
trap 'rc=143; exit' TERM INT
if [ -f "$RUNNING" ]; then log "warn backup_prune: 지난 실행이 끝 줄 없이 끝남($(tr '\n' ' ' < "$RUNNING"))"; fi
printf 'pid=%s start=%s\n' "$$" "$(date '+%Y-%m-%d %H:%M:%S')" > "$RUNNING"
log "start backup_prune pid=$$ target=$BASE/backups"
# 정리 출력 한 줄 한 줄을 진행 줄로 남긴다(출력이 없어도 부르기 직전 진행 줄 하나는 남긴다)
log "step backup_prune 정리 명령 실행"
$PRUNE_CMD 2>&1 | while IFS= read -r line; do log "step backup_prune $line"; done
rc=${PIPESTATUS[0]}
