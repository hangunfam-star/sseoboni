#!/usr/bin/env bash
# 써보니 운영 반영(MWWork 211.110.139.206, Docker 컨테이너 sseoboni). Git Bash에서 실행.
# 커밋·푸시된 HEAD의 app 폴더만 보낸다(작업 중 파일은 가지 않음). 커밋은 따로 한다.
# 사용: bash ops/deploy.sh            → 빌드·재시작
#       bash ops/deploy.sh --migrate  → 운영 DB 백업 → 컨테이너 멈춤 → 마이그레이션 → 재시작(drizzle 새 파일이 있을 때)
#       PRUNE_BACKUPS=1 bash ops/deploy.sh --migrate → 위 백업 뒤 30일 넘은 운영 DB 백업 정리(ops/backup_prune.sh)까지(기본 꺼짐)
# 서버 쪽 단계는 ops/remote_deploy.sh가 한다: 한 단계라도 실패하면 멈추고 이 스크립트도 실패 코드로 끝난다.
# 매일 30일 정리는 서버에 ops/install_prune_cron.sh를 따로 설치한다(기본 설치 안 함, 사용자 승인 뒤).
# 필요: ~/.ssh/id_ed25519_mwwork (서버 root 키). 비밀값(.env)은 서버 /opt/sseoboni/.env에만 있다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# 사용자 폴더 이름이 한글이라 ssh가 ~/.ssh/known_hosts를 못 찾는 경우가 있어 영문 경로로 복사해 쓴다
cp "$HOME/.ssh/known_hosts" "$TMP/kh"
O="-i $HOME/.ssh/id_ed25519_mwwork -o BatchMode=yes -o IdentitiesOnly=yes -o LogLevel=ERROR -o UserKnownHostsFile=$TMP/kh"
H=root@211.110.139.206
cd "$ROOT"
if [ -n "$(git status --porcelain app/src app/drizzle app/scripts app/public)" ]; then echo "app에 커밋 안 한 변경이 있어요. 커밋 뒤 다시 실행하세요."; exit 1; fi
git log --oneline -1
git archive --format=tar.gz -o "$TMP/src.tgz" HEAD:app
# 서버 단계 스크립트도 커밋된 HEAD 것을 보낸다
mkdir -p "$TMP/ops"
git show HEAD:ops/remote_deploy.sh > "$TMP/ops/remote_deploy.sh"
git show HEAD:ops/backup_prune.sh > "$TMP/ops/backup_prune.sh"
git show HEAD:ops/prune_cron_run.sh > "$TMP/ops/prune_cron_run.sh"
git show HEAD:ops/install_prune_cron.sh > "$TMP/ops/install_prune_cron.sh"
scp $O "$TMP/src.tgz" $H:/opt/sseoboni/
ssh $O $H "mkdir -p /opt/sseoboni/ops"
scp $O "$TMP/ops/remote_deploy.sh" "$TMP/ops/backup_prune.sh" "$TMP/ops/prune_cron_run.sh" "$TMP/ops/install_prune_cron.sh" $H:/opt/sseoboni/ops/
MODE=plain; [ "${1:-}" = "--migrate" ] && MODE=migrate
PRUNE=0; [ "$MODE" = migrate ] && [ "${PRUNE_BACKUPS:-0}" = "1" ] && PRUNE=1
ssh $O $H "PRUNE=$PRUNE bash /opt/sseoboni/ops/remote_deploy.sh $MODE"
