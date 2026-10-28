#!/usr/bin/env bash
# 운영 서버에서 실행하는 배포 단계(ops/deploy.sh가 복사해 부른다). 한 단계라도 실패하면 거기서 멈추고 실패 코드로 끝난다(Codex 2차 지적: 실패를 성공으로 덮지 않음).
# 사용: bash remote_deploy.sh migrate|plain   (PRUNE=1 이면 migrate 때 사전 백업 뒤 30일 정리 ops/backup_prune.sh도 실행)
# 환경: BASE(기본 /opt/sseoboni). 시험은 BASE와 PATH의 가짜 docker·curl로 한다(ops/e2e/suites/test_deploy_failclosed.sh).
# return: 모든 단계 성공 0, 아니면 실패한 단계의 종료 코드. 마지막 줄 deploy_exit=<코드>
set -euo pipefail
BASE="${BASE:-/opt/sseoboni}"
MODE="${1:-plain}"
# param: 없음. return: 원래 종료 코드 그대로(이미지 정리 실패가 결과를 바꾸지 않음)
finish() { rc=$?; docker image prune -f >/dev/null 2>&1 || true; echo "deploy_exit=$rc"; exit "$rc"; }
trap finish EXIT
RUN=(docker run -d --name sseoboni --restart unless-stopped --env-file "$BASE/.env" -e TZ=Asia/Seoul -v "$BASE/data:/data" -v "$BASE/runtime-data:/app/runtime-data" -p 127.0.0.1:3100:3000 sseoboni:latest)
cd "$BASE"
rm -rf src && mkdir src && tar xzf src.tgz -C src
cd src
docker build -t sseoboni:latest . > "$BASE/build.log" 2>&1
echo "build=ok"
if [ "$MODE" = "migrate" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BASE/data/.bk"
  docker exec sseoboni node -e 'const D=require("better-sqlite3");new D("/data/dev.db",{readonly:true}).backup("/data/.bk/b.db").then(()=>console.log("backup ok")).catch((e)=>{console.error("backup fail",e.message);process.exit(1)})'
  mv "$BASE/data/.bk/b.db" "$BASE/backups/dev.db.before-$TS"
  rmdir "$BASE/data/.bk"
  echo "backup=dev.db.before-$TS"
  if [ "${PRUNE:-0}" = "1" ]; then
    docker run --rm -v "$BASE/data:/data" -v "$BASE/backups:/backups" -v "$BASE/ops:/ops:ro" -e APP_DIR=/app sseoboni:latest bash /ops/backup_prune.sh /backups /data/dev.db
    echo "prune=ok"
  fi
  docker stop sseoboni >/dev/null
  docker run --rm -v "$BASE/data:/data" sseoboni:latest node scripts/migrate.cjs /data/dev.db
  docker rm sseoboni >/dev/null
  "${RUN[@]}" >/dev/null
  CHECK=/
else
  docker rm -f sseoboni >/dev/null
  "${RUN[@]}" >/dev/null
  CHECK=/login
fi
sleep "${WAIT_SEC:-8}"
code="$(curl -sS --fail --max-time 30 -o /dev/null -w '%{http_code}' "http://127.0.0.1:3100$CHECK")"
echo "http $CHECK $code"
