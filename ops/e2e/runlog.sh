#!/usr/bin/env bash
# 89절(자동 실행 로그 세 줄): 사람이 보지 않는 실행기가 같은 로그에 시작·진행·끝 줄을 남기게 한다. source 해서 쓴다.
# param: RUNLOG(로그 경로), RUNNAME(실행기 이름)을 먼저 정한다. 사용: . ops/e2e/runlog.sh; runlog_begin "대상"; runlog_step "내용"
# return: 끝 줄은 EXIT trap(finally 역할)에서 종료코드와 함께 쓴다. 진행 중 표시 파일(<로그>.<이름>.running)은 끝 줄 뒤에만 지운다.
#         다음 실행이 표시 파일을 발견하면 "지난 실행이 끝 줄 없이 끝남"을 로그와 화면(stderr)에 남긴다(강제 종료·전원 꺼짐 등).
export PATH="/usr/bin:$PATH"   # date·cat·rm을 Git Bash 것으로(호출한 쪽 PATH와 무관하게)
runlog_ts() { date '+%Y-%m-%d %H:%M:%S'; }
runlog_begin() {
  RUNMARK="${RUNLOG%.log}.${RUNNAME}.running"
  if [ -f "$RUNMARK" ]; then
    echo "[$(runlog_ts)] 경고 $RUNNAME 지난 실행이 끝 줄 없이 끝남 ($(cat "$RUNMARK"))" >> "$RUNLOG"
    echo "경고: $RUNNAME 지난 실행이 끝 줄 없이 끝남 ($(cat "$RUNMARK"))" >&2
  fi
  echo "pid=$$ 시작=$(runlog_ts) 대상=$1" > "$RUNMARK"
  echo "[$(runlog_ts)] 시작 $RUNNAME pid=$$ 대상=$1" >> "$RUNLOG"
  trap 'runlog_end $?' EXIT
  trap 'RUNLOG_REASON="중단 신호"; exit 130' INT TERM HUP
}
runlog_step() { echo "[$(runlog_ts)] 진행 $RUNNAME $*" >> "$RUNLOG"; }
runlog_end() {
  local rc=$1 why=${RUNLOG_REASON:-}
  [ -z "$why" ] && { [ "$rc" -eq 0 ] && why=정상 || why=실패; }
  echo "[$(runlog_ts)] 끝 $RUNNAME pid=$$ 종료코드=$rc 사유=$why" >> "$RUNLOG"
  rm -f "$RUNMARK"
}
