#!/usr/bin/env bash
# 격리 시험 서버 띄우기(운영과 완전히 분리). Git Bash(Windows)에서 실행.
#   1) app/dev.db를 ops/e2e/.out/copy.db로 복사 → 마이그레이션
#   2) 가짜 카카오(3299) · 가짜 푸시(3298) · 개발 서버(3200) 실행, 자주 쓰는 화면 미리 컴파일
# 사용: bash ops/e2e/run_isolated.sh            → 서버만 띄움
#       NICK=1 bash ops/e2e/run_isolated.sh     → 예전(legacy) 시험용: 닉네임 새 계정 허용(개발 서버에서만 동작)
# 시험 실행 예: python ops/e2e/suites/test_photo.py "$(cygpath -w ops/e2e/.out/copy.db)" "$(cygpath -w ops/e2e/.out/shots)"
# 주의: 계정 만들기는 IP당 1시간 20개(메모리)라 큰 시험을 여러 개 돌릴 때는 이 스크립트로 서버를 다시 띄운다.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/ops/e2e/.out"
for port in 3200 3298 3299; do PID=$(netstat -ano | grep ":$port " | grep LISTEN | awk '{print $5}' | head -1); [ -n "$PID" ] && taskkill //PID $PID //T //F >/dev/null || true; done
mkdir -p "$OUT/shots"
cd "$ROOT/app"
rm -f "$OUT"/copy.db*
node -e "const D=require('better-sqlite3');new D('dev.db',{readonly:true}).backup(process.argv[1]).then(()=>console.log('copied'))" "$(cygpath -w "$OUT/copy.db")"
node scripts/migrate.cjs "$(cygpath -w "$OUT/copy.db")" | tail -1
echo '{"tradeOpen": true}' > "$OUT/ts.json"
(nohup python "$ROOT/ops/e2e/fake_kakao.py" 3299 > "$OUT/fake_kakao.log" 2>&1 &)
(nohup node "$ROOT/ops/e2e/fake_push.cjs" "$(cygpath -w "$ROOT/app")" 3298 > "$OUT/fake_push.log" 2>&1 &)
EXTRA=""; [ "$NICK" = "1" ] && EXTRA="ALLOW_NICKNAME_LOGIN=1"
[ "$WITHDRAW" = "1" ] && EXTRA="$EXTRA WITHDRAW_ENABLED=1"   # 탈퇴 시험: WITHDRAW=1 bash ops/e2e/run_isolated.sh (기본은 꺼짐)
# 탈퇴 2단계 보관 키(시험용, .out 아래 무작위 값 — 운영 값 아님). 없으면 탈퇴 POST가 사전 점검에서 503
if [ "$WITHDRAW" = "1" ]; then
  [ -s "$OUT/retain_secret.txt" ] || node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64'))" > "$OUT/retain_secret.txt"
  EXTRA="$EXTRA RETAIN_SECRET=$(cat "$OUT/retain_secret.txt")"
fi
[ -n "$WITHDRAW_FAULT" ] && EXTRA="$EXTRA WITHDRAW_FAULT=$WITHDRAW_FAULT"   # 탈퇴 오류 주입 시험(T13) 전용
(env DATABASE_URL="file:$(cygpath -w "$OUT/copy.db")" TRADE_SETTINGS_FILE="$(cygpath -w "$OUT/ts.json")" \
  KAKAO_REST_KEY=testkey KAKAO_CLIENT_SECRET=testsecret KAKAO_AUTH_BASE=http://localhost:3299 KAKAO_API_BASE=http://localhost:3299 KAKAO_REDIRECT_URI= \
  $EXTRA nohup npx next dev -p 3200 > "$OUT/dev.log" 2>&1 &)
for i in $(seq 1 60); do sleep 3; curl -s -o /dev/null -w '%{http_code}' http://localhost:3200/login | grep -q 200 && break; done
for u in / /login /me /demand /listings/new /chats /api/models /api/chats /notifications /wishlist; do curl -s -o /dev/null --max-time 120 "http://localhost:3200$u"; done
curl -s -o /dev/null --max-time 120 -X POST http://localhost:3200/api/profile-photo
echo "격리 서버 준비됨: http://localhost:3200 (DB $OUT/copy.db, 로그 $OUT/dev.log)"
