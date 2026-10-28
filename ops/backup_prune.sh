#!/usr/bin/env bash
# 운영 DB 백업 30일 정리(탈퇴 2단계, docs/review/WITHDRAW_PLAN_v12.md 0000절 7). 30일이 절대 상한이다(최신 몇 개 예외 없음).
# 순서: ① 새 백업을 만들고 ② 열어서 PRAGMA integrity_check가 ok인지 확인한 뒤에만 ③ 30일 넘은 백업(dev.db.*)을 지운다.
# 사용: bash ops/backup_prune.sh <백업 폴더> <DB 경로> [보관 일수=30]
#   NODE   node 실행 명령(기본 node). APP_DIR  better-sqlite3가 있는 app 폴더(기본 이 스크립트의 ../app)
# 운영: ops/deploy.sh --migrate가 PRUNE_BACKUPS=1일 때만 서버에서 실행한다(기본 꺼짐, 첫 실행은 사용자 승인 뒤).
set -euo pipefail
DIR="${1:?백업 폴더를 넣어 주세요}"
DB="${2:?DB 경로를 넣어 주세요}"
DAYS="${3:-30}"
NODE="${NODE:-node}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../app" && pwd)}"
[ -d "$DIR" ] || { echo "백업 폴더가 없어요: $DIR"; exit 1; }
TS="$(date +%Y%m%d-%H%M%S)"
NEW="$DIR/dev.db.before-prune-$TS"
# param: 원본 DB, 새 백업 경로. 결과: 백업 뒤 integrity_check가 ok가 아니면 실패(종료 코드 1)
$NODE -e '
const D = require(require.resolve("better-sqlite3", { paths: [process.argv[3]] }));
const [src, dst] = [process.argv[1], process.argv[2]];
new D(src, { readonly: true }).backup(dst).then(() => {
  const w = new D(dst); w.pragma("journal_mode = DELETE"); w.close(); // 백업 한 파일로(-wal·-shm 안 남김)
  const c = new D(dst, { readonly: true }); const r = c.pragma("integrity_check", { simple: true }); c.close();
  if (r !== "ok") { console.error("새 백업 검증 실패:", r); process.exit(1); }
  console.log("새 백업 검증 ok");
}).catch((e) => { console.error("새 백업 실패:", e.message); process.exit(1); });
' "$DB" "$NEW" "$APP_DIR" || { echo "새 백업을 확인하지 못해 아무것도 지우지 않았어요."; rm -f "$NEW"; exit 1; }
echo "new=$(basename "$NEW")"
# 보관 일수보다 오래된 백업(분 단위로 비교, 새로 만든 것 제외)만 지운다
COUNT=0
while IFS= read -r -d '' f; do
  [ "$f" = "$NEW" ] && continue
  rm -f -- "$f" && COUNT=$((COUNT + 1)) && echo "deleted=$(basename "$f")"
done < <(find "$DIR" -maxdepth 1 -type f -name 'dev.db.*' -mmin +$((DAYS * 1440)) -print0)
echo "deleted_count=$COUNT"
