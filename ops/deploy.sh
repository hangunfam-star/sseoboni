#!/usr/bin/env bash
# 써보니 운영 반영(MWWork 211.110.139.206, Docker 컨테이너 sseoboni). Git Bash에서 실행.
# 커밋·푸시된 HEAD의 app 폴더만 보낸다(작업 중 파일은 가지 않음). 커밋은 따로 한다.
# 사용: bash ops/deploy.sh            → 빌드·재시작
#       bash ops/deploy.sh --migrate  → 운영 DB 백업 → 컨테이너 멈춤 → 마이그레이션 → 재시작(drizzle 새 파일이 있을 때)
# 필요: ~/.ssh/id_ed25519_mwwork (서버 root 키). 비밀값(.env)은 서버 /opt/sseoboni/.env에만 있다.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
# 사용자 폴더 이름이 한글이라 ssh가 ~/.ssh/known_hosts를 못 찾는 경우가 있어 영문 경로로 복사해 쓴다
cp "$HOME/.ssh/known_hosts" "$TMP/kh"
O="-i $HOME/.ssh/id_ed25519_mwwork -o BatchMode=yes -o IdentitiesOnly=yes -o LogLevel=ERROR -o UserKnownHostsFile=$TMP/kh"
cd "$ROOT"
if [ -n "$(git status --porcelain app/src app/drizzle app/scripts app/public)" ]; then echo "app에 커밋 안 한 변경이 있어요. 커밋 뒤 다시 실행하세요."; exit 1; fi
git log --oneline -1
git archive --format=tar.gz -o "$TMP/src.tgz" HEAD:app
scp $O "$TMP/src.tgz" root@211.110.139.206:/opt/sseoboni/
RUN='docker run -d --name sseoboni --restart unless-stopped --env-file /opt/sseoboni/.env -e TZ=Asia/Seoul -v /opt/sseoboni/data:/data -v /opt/sseoboni/runtime-data:/app/runtime-data -p 127.0.0.1:3100:3000 sseoboni:latest >/dev/null'
if [ "$1" = "--migrate" ]; then
  ssh $O root@211.110.139.206 "cd /opt/sseoboni && rm -rf src && mkdir src && tar xzf src.tgz -C src && cd src && docker build -t sseoboni:latest . > /opt/sseoboni/build.log 2>&1; echo build=\$?; TS=\$(date +%Y%m%d-%H%M%S); mkdir -p /opt/sseoboni/data/.bk && docker exec sseoboni node -e 'const D=require(\"better-sqlite3\");new D(\"/data/dev.db\",{readonly:true}).backup(\"/data/.bk/b.db\").then(()=>console.log(\"backup ok\"))' && mv /opt/sseoboni/data/.bk/b.db /opt/sseoboni/backups/dev.db.before-\$TS && rmdir /opt/sseoboni/data/.bk && echo backup=dev.db.before-\$TS; docker stop sseoboni >/dev/null && docker run --rm -v /opt/sseoboni/data:/data sseoboni:latest node scripts/migrate.cjs /data/dev.db && docker rm sseoboni >/dev/null && $RUN && sleep 8 && curl -s -o /dev/null -w 'home %{http_code}\n' http://127.0.0.1:3100/; docker image prune -f >/dev/null"
else
  ssh $O root@211.110.139.206 "cd /opt/sseoboni && rm -rf src && mkdir src && tar xzf src.tgz -C src && cd src && docker build -t sseoboni:latest . > /opt/sseoboni/build.log 2>&1; echo build=\$?; docker rm -f sseoboni >/dev/null && $RUN && sleep 8 && curl -s -o /dev/null -w 'login %{http_code}\n' http://127.0.0.1:3100/login; docker image prune -f >/dev/null"
fi
rm -rf "$TMP"
