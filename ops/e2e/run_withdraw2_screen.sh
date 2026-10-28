#!/usr/bin/env bash
# 탈퇴 2단계 화면 시험: 묶음마다 격리 서버(보관 키 포함)를 다시 띄운다. Git Bash에서 실행.
# 사용: bash ops/e2e/run_withdraw2_screen.sh [묶음…]   묶음: w1m(1단계 모바일 다시) s2pc s2m. 기본은 셋 다
# 결과: ops/e2e/.out/withdraw2_screen.log (마지막 줄 SUMMARY), 하나라도 실패하면 종료코드 1
export PATH="/usr/bin:/mingw64/bin:/c/Python314:/c/Program Files/nodejs:/c/Windows/System32:$PATH"
export PLAYWRIGHT_BROWSERS_PATH='E:\PROJECTS\_work\_tools\ms-playwright' TEMP='E:\PROJECTS\_work\_tools\tmp' TMP='E:\PROJECTS\_work\_tools\tmp' PYTHONIOENCODING=utf-8
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
PY=/e/PROJECTS/_work/_tools/pyenv-pw/Scripts/python.exe
LOG=ops/e2e/.out/withdraw2_screen.log; mkdir -p ops/e2e/.out; : > "$LOG"
RUNLOG=$LOG RUNNAME=withdraw2_screen; . ops/e2e/runlog.sh; runlog_begin "탈퇴 2단계 화면 시험 ${*:-w1m s2pc s2m}"
D="$(cygpath -w ops/e2e/.out/copy.db)"; S="$(cygpath -w ops/e2e/.out/shots)"
summary=""; failed=0
# return: 격리 서버가 뜨고 /login이 200이면 0
start() { env WITHDRAW=1 bash ops/e2e/run_isolated.sh >/dev/null 2>&1 || return 1; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:3200/login)" = "200" ]; }
for s in ${*:-w1m s2pc s2m}; do
  runlog_step "$s 서버 기동"
  start || start || { echo "### $s 서버 기동 실패" >> "$LOG"; summary="$summary $s=START_FAIL"; failed=$((failed + 1)); continue; }
  # 첫 컴파일이 느려 로그인 화면이 시간 초과되는 일을 막으려고 로그인 경로를 미리 연다
  for u in /api/auth/kakao/start /login/kakao /me/account /orders /withdrawn; do curl -s -o /dev/null --max-time 180 "http://localhost:3200$u"; done
  echo "### $s" >> "$LOG"
  case $s in
    w1m) "$PY" ops/e2e/suites/test_withdraw.py "$D" "$S" m >> "$LOG" 2>&1 ;;
    s2pc) "$PY" ops/e2e/suites/test_withdraw2_screen.py "$D" "$S" pc >> "$LOG" 2>&1 ;;
    s2m) "$PY" ops/e2e/suites/test_withdraw2_screen.py "$D" "$S" m >> "$LOG" 2>&1 ;;
  esac
  rc=$?; echo "### $s exit=$rc" >> "$LOG"; summary="$summary $s=$rc"; [ "$rc" -ne 0 ] && failed=$((failed + 1))
done
echo "SUMMARY$summary failed=$failed" >> "$LOG"
[ "$failed" -eq 0 ] || exit 1
