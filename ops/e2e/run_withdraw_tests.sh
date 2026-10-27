#!/usr/bin/env bash
# 탈퇴 1단계 시험 한 번에 돌리기: PC → 모바일 → 오류 주입 → 단위. 묶음마다 격리 서버를 다시 띄운다(계정 만들기 제한 초기화). Git Bash에서 실행.
# 사용: bash ops/e2e/run_withdraw_tests.sh   → 결과: ops/e2e/.out/withdraw_tests.log (마지막 줄 요약), 하나라도 실패하면 종료코드 1
#       START_FAIL=1 bash ops/e2e/run_withdraw_tests.sh → 서버 기동 실패를 일부러 만들어 종료코드 1이 나오는지 확인(실행기 자체 시험)
export PATH="/usr/bin:/mingw64/bin:/c/Python314:/c/Program Files/nodejs:/c/Windows/System32:$PATH"
export PLAYWRIGHT_BROWSERS_PATH='E:\PROJECTS\_work\_tools\ms-playwright' TEMP='E:\PROJECTS\_work\_tools\tmp' TMP='E:\PROJECTS\_work\_tools\tmp' PYTHONIOENCODING=utf-8
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
PY=/e/PROJECTS/_work/_tools/pyenv-pw/Scripts/python.exe
LOG=ops/e2e/.out/withdraw_tests.log; mkdir -p ops/e2e/.out; : > "$LOG"
RUNLOG=$LOG RUNNAME=withdraw_tests; . ops/e2e/runlog.sh; runlog_begin "탈퇴 시험 pc·m·fault·unit START_FAIL=${START_FAIL:-0}"
D="$(cygpath -w ops/e2e/.out/copy.db)"; S="$(cygpath -w ops/e2e/.out/shots)"
summary=""; failed=0
# param: 환경변수 VAR=값 …. return: 격리 서버가 뜨고 /login이 200이면 0, 아니면 1
start() {
  [ "$START_FAIL" = "1" ] && return 1
  env "$@" bash ops/e2e/run_isolated.sh >/dev/null 2>&1 || return 1
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:3200/login)" = "200" ]
}
for mode in pc m fault; do
  runlog_step "$mode 서버 기동"
  # 캐시가 비어 첫 컴파일이 느리면 기동 대기(3분)를 넘길 수 있어 한 번 더 시도한다
  if [ "$mode" = fault ]; then start WITHDRAW=1 WITHDRAW_FAULT=after_p6 || start WITHDRAW=1 WITHDRAW_FAULT=after_p6; else start WITHDRAW=1 || start WITHDRAW=1; fi
  if [ $? -ne 0 ]; then echo "### $mode 서버 기동 실패" >> "$LOG"; summary="$summary $mode=START_FAIL"; failed=$((failed + 1)); continue; fi
  echo "### $mode" >> "$LOG"; "$PY" ops/e2e/suites/test_withdraw.py "$D" "$S" "$mode" >> "$LOG" 2>&1; rc=$?
  echo "### $mode exit=$rc" >> "$LOG"; summary="$summary $mode=$rc"; [ "$rc" -ne 0 ] && failed=$((failed + 1))
done
runlog_step "unit 시작"
(cd app && DATABASE_URL="file:../ops/e2e/.out/copy.db" npx tsx ../ops/e2e/suites/withdraw_unit.ts) >> "$LOG" 2>&1; rc=$?; summary="$summary unit=$rc"; [ "$rc" -ne 0 ] && failed=$((failed + 1))
echo "SUMMARY$summary failed=$failed" >> "$LOG"
[ "$failed" -eq 0 ] || exit 1
