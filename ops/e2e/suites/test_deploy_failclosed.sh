#!/usr/bin/env bash
# 배포 실패 전파 시험(Codex 2차 지적 2건): ops/remote_deploy.sh를 가짜 docker·curl·tar로 돌려 단계마다 실패를 넣는다. 서버·DB 안 씀.
# 사용(Git Bash): bash ops/e2e/suites/test_deploy_failclosed.sh  → 마지막 줄 SUMMARY, 실패 있으면 종료코드 1
export PATH="/usr/bin:/mingw64/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
W="/e/PROJECTS/_work/04_써보니/deploy_test"; rm -rf "$W"; mkdir -p "$W/stub"
pass=0; fail=0
check() { if [ "$2" = 1 ]; then echo "PASS $1"; pass=$((pass + 1)); else echo "FAIL $1 $3"; fail=$((fail + 1)); fi; }
# 가짜 명령: 부른 인자를 CALLS에 적고, FAIL에 든 단어가 인자에 있으면 실패한다
cat > "$W/stub/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$CALLS"
for f in $FAIL; do case "$*" in *"$f"*) exit 3 ;; esac; done
[ "$1" = exec ] && touch "$BASE/data/.bk/b.db"
exit 0
EOF
cat > "$W/stub/curl" <<'EOF'
#!/usr/bin/env bash
echo "curl $*" >> "$CALLS"
for f in $FAIL; do [ "$f" = http ] && exit 22; done
printf 200
EOF
printf '#!/usr/bin/env bash\necho "tar $*" >> "$CALLS"\n' > "$W/stub/tar"
chmod +x "$W/stub/"*
# param: 이름, 모드, FAIL 단어, PRUNE. return: 종료 코드를 RC에, 부른 명령을 CALLS 파일에
run() {
  export BASE="$W/base_$1" CALLS="$W/calls_$1" FAIL="$3" PRUNE="${4:-0}" WAIT_SEC=0
  rm -rf "$BASE"; mkdir -p "$BASE/backups" "$BASE/data"; : > "$BASE/src.tgz"; : > "$CALLS"
  PATH="$W/stub:$PATH" bash "$ROOT/ops/remote_deploy.sh" "$2" > "$W/out_$1" 2>&1; RC=$?
}
has() { grep -q -- "$2" "$W/calls_$1"; }
run ok migrate "" 1
check "정상: 종료 0, 백업·정리·마이그레이션·재시작·HTTP 모두 실행" "$([ $RC = 0 ] && has ok exec && has ok backup_prune && has ok migrate.cjs && has ok 'run -d' && has ok curl && echo 1)" "rc=$RC"
run build migrate "build" 1
check "build 실패 → 전체 실패, 백업·마이그레이션 안 함" "$([ $RC != 0 ] && ! has build exec && ! has build migrate.cjs && echo 1)" "rc=$RC"
run backup migrate "exec" 1
check "사전 백업 실패 → 전체 실패, 정리·마이그레이션 안 함" "$([ $RC != 0 ] && ! has backup backup_prune && ! has backup migrate.cjs && echo 1)" "rc=$RC"
run prune migrate "backup_prune" 1
check "백업 정리 실패 → 전체 실패, 마이그레이션 안 함" "$([ $RC != 0 ] && ! has prune migrate.cjs && echo 1)" "rc=$RC"
run mig migrate "migrate.cjs" 0
check "마이그레이션 실패 → 전체 실패, 재시작 안 함" "$([ $RC != 0 ] && ! has mig 'run -d' && echo 1)" "rc=$RC"
run restart migrate "run -d" 0
check "재시작 실패 → 전체 실패" "$([ $RC != 0 ] && echo 1)" "rc=$RC"
run http plain "http" 0
check "HTTP 오류(curl --fail) → 전체 실패" "$([ $RC != 0 ] && echo 1)" "rc=$RC"
run imgcln plain "image" 0
check "이미지 정리만 실패 → 결과는 성공 그대로" "$([ $RC = 0 ] && has imgcln 'image prune' && echo 1)" "rc=$RC"
run noprune migrate "" 0
check "PRUNE 꺼짐 → 백업 정리 안 부름" "$([ $RC = 0 ] && ! has noprune backup_prune && echo 1)" "rc=$RC"
# 매일 정리 예약 작업: 설치 파일 내용과, 그 명령이 배포 없이 혼자 정리를 부르는지
export BASE="$W/cron" CRON_FILE="$W/cron/cron.d" CALLS="$W/calls_cron" FAIL=""
mkdir -p "$BASE/ops"; : > "$CALLS"
bash "$ROOT/ops/install_prune_cron.sh" apply > /dev/null 2>&1; r1=$?
mv "$BASE/ops" "$BASE/ops_x"; bash "$ROOT/ops/install_prune_cron.sh" apply > /dev/null 2>&1; r0=$?; mv "$BASE/ops_x" "$BASE/ops"
: > "$BASE/ops/backup_prune.sh"; rm -f "$CRON_FILE"; bash "$ROOT/ops/install_prune_cron.sh" apply > /dev/null 2>&1; r1=$?
cp "$ROOT/ops/prune_cron_run.sh" "$BASE/ops/"; bash "$ROOT/ops/install_prune_cron.sh" apply > /dev/null 2>&1; r2=$?
check "예약 설치: 정리·실행기 스크립트 없으면 거절, 있으면 매일 04:30 줄 설치" "$([ $r0 != 0 ] && [ $r1 != 0 ] && [ $r2 = 0 ] && grep -q '^30 4 \* \* \* root .*prune_cron_run.sh' "$CRON_FILE" && echo 1)" "r0=$r0 r1=$r1 r2=$r2"
cmd="$(grep '^30 4' "$CRON_FILE" | sed 's/^30 4 \* \* \* root //')"
L="$BASE/backup_prune.log"
# ① 정상: 예약 줄 그대로(가짜 docker) → 정리 호출, 시작·진행·끝 줄, 종료 0, 표시 파일·잠금 없음
PATH="$W/stub:$PATH" bash -c "$cmd"; rc=$?
check "예약 정상 → 종료 0, 정리 호출, 시작·진행·끝(exit=0) 줄, 표시 파일·잠금 남지 않음" "$([ $rc = 0 ] && has cron backup_prune && grep -q 'start backup_prune' "$L" && grep -q 'step backup_prune' "$L" && grep -q 'end backup_prune .*exit=0' "$L" && [ ! -e "$BASE/backup_prune.running" ] && [ ! -e "$BASE/backup_prune.lock.d" ] && echo 1)" "rc=$rc"
# ② 정리 실패: 실행기 종료 코드가 실패 그대로, 끝 줄 exit=3
: > "$L"; FAIL="backup_prune" PATH="$W/stub:$PATH" bash -c "$cmd"; rc=$?
check "예약 정리 실패 → 종료 3 그대로, 끝 줄 exit=3" "$([ $rc = 3 ] && grep -q 'end backup_prune .*exit=3' "$L" && echo 1)" "rc=$rc"
# ③ 지난 실행이 끝 줄 없이 끝남(표시 파일 남음) → 다음 실행이 알리고 정상 진행
: > "$L"; echo "pid=99999 start=옛날" > "$BASE/backup_prune.running"; PATH="$W/stub:$PATH" bash -c "$cmd"; rc=$?
check "남은 표시 파일 → '지난 실행이 끝 줄 없이 끝남' 기록, 이번 실행은 끝까지(종료 0)" "$([ $rc = 0 ] && grep -q '지난 실행이 끝 줄 없이 끝남' "$L" && grep -q 'end backup_prune .*exit=0' "$L" && echo 1)" "rc=$rc"
# ④ 동시 실행: 살아 있는 프로세스가 잠금을 쥐고 있으면 건너뜀(75), 정리 호출 없음. 주인 없는 잠금은 치우고 진행
: > "$L"; : > "$CALLS"; mkdir "$BASE/backup_prune.lock.d"; sleep 30 & hold=$!; echo $hold > "$BASE/backup_prune.lock.d/pid"
PATH="$W/stub:$PATH" bash -c "$cmd"; rc=$?; kill $hold 2>/dev/null
check "동시 실행 → 종료 75, 정리 안 부름, 건너뜀 기록" "$([ $rc = 75 ] && ! has cron backup_prune && grep -q 'skip backup_prune' "$L" && echo 1)" "rc=$rc"
echo 99999 > "$BASE/backup_prune.lock.d/pid"; PATH="$W/stub:$PATH" bash -c "$cmd"; rc=$?
check "주인 없는 잠금 → 치우고 진행(종료 0)" "$([ $rc = 0 ] && grep -q '주인 없는 잠금' "$L" && has cron backup_prune && echo 1)" "rc=$rc"
bash "$ROOT/ops/install_prune_cron.sh" remove > /dev/null
check "예약 제거" "$([ ! -f "$CRON_FILE" ] && echo 1)"
echo "SUMMARY pass=$pass fail=$fail"
[ "$fail" = 0 ]
