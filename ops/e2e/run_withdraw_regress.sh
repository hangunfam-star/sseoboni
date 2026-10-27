#!/usr/bin/env bash
# 탈퇴 1단계 회귀(T10 서버 확인 + T12). 묶음마다 격리 서버를 기본(탈퇴 꺼짐)으로 다시 띄운다. Git Bash에서 실행.
# 사용: bash ops/e2e/run_withdraw_regress.sh   → 결과: ops/e2e/.out/regress_withdraw.log (마지막 줄 요약), 하나라도 실패하면 종료코드 1
#       START_FAIL=1 bash ops/e2e/run_withdraw_regress.sh → 서버 기동 실패를 일부러 만들어 종료코드 1이 나오는지 확인(실행기 자체 시험)
export PATH="/usr/bin:/mingw64/bin:/c/Python314:/c/Program Files/nodejs:/c/Windows/System32:$PATH"
export PLAYWRIGHT_BROWSERS_PATH='E:\PROJECTS\_work\_tools\ms-playwright' TEMP='E:\PROJECTS\_work\_tools\tmp' TMP='E:\PROJECTS\_work\_tools\tmp' PYTHONIOENCODING=utf-8
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
PY=/e/PROJECTS/_work/_tools/pyenv-pw/Scripts/python.exe
LOG=ops/e2e/.out/regress_withdraw.log; mkdir -p ops/e2e/.out; : > "$LOG"
RUNLOG=$LOG RUNNAME=withdraw_regress; . ops/e2e/runlog.sh; runlog_begin "탈퇴 회귀 T10·checks·checks_fix·logout·nicklock·unit START_FAIL=${START_FAIL:-0}"
D="$(cygpath -w ops/e2e/.out/copy.db)"; S="$(cygpath -w ops/e2e/.out/shots)"; L="$(cygpath -w ops/e2e/.out/dev.log)"
summary=""; failed=0
# return: 격리 서버(탈퇴 꺼짐)가 뜨고 /login이 200이면 0, 아니면 1
start() {
  [ "$START_FAIL" = "1" ] && return 1
  bash ops/e2e/run_isolated.sh >/dev/null 2>&1 || return 1
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:3200/login)" = "200" ]
}
run() { # param: 이름, 명령… return: 요약에 "이름=종료코드" 추가, 0이 아니면(서버 기동 실패 포함) failed 증가
  local name=$1; shift
  runlog_step "$name 시작"
  if ! start; then echo "### $name 서버 기동 실패" >> "$LOG"; summary="$summary $name=START_FAIL"; failed=$((failed + 1)); return; fi
  echo "### $name" >> "$LOG"; "$@" >> "$LOG" 2>&1; local rc=$?
  echo "### $name exit=$rc" >> "$LOG"; summary="$summary $name=$rc"; [ "$rc" -ne 0 ] && failed=$((failed + 1))
}
# T10: 탈퇴 꺼진 서버에서 API 503, 버튼 없음
if start; then
  g=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3200/api/me/withdraw)
  p=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"confirm":"탈퇴합니다"}' http://localhost:3200/api/me/withdraw)
  echo "### T10 기본 서버 GET=$g POST=$p (기대 503 503)" >> "$LOG"; summary="$summary T10=$g/$p"; [ "$g/$p" != "503/503" ] && failed=$((failed + 1))
else
  echo "### T10 서버 기동 실패" >> "$LOG"; summary="$summary T10=START_FAIL"; failed=$((failed + 1))
fi
run checks "$PY" ops/e2e/suites/test_checks.py "$D" "$S"
run checks_fix "$PY" ops/e2e/suites/test_checks_fix.py "$D" "$S"
run logout "$PY" ops/e2e/suites/test_logout.py "$S"
run nicklock "$PY" ops/e2e/suites/test_nicklock.py "$D" "$S" "$L"
# legacy/test_notify.py는 점검표 필수화(커밋 5cffc23) 이전 시험이라 상품 등록에서 멈춘다(탈퇴와 무관, 별도 수정 대상). 알림 회귀는 10명 시뮬레이션으로 대신 확인한다.
(cd app && npx tsx --test src/ui/*.test.ts) >> "$LOG" 2>&1; rc=$?; summary="$summary unit=$rc"; [ "$rc" -ne 0 ] && failed=$((failed + 1))
echo "SUMMARY$summary failed=$failed" >> "$LOG"
[ "$failed" -eq 0 ] || exit 1
