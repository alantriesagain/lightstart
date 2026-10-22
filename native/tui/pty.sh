#!/usr/bin/env bash
# The pty gate: build native/tui/demo.js, run it in a pseudo-terminal of 80x24, click the button,
# turn the wheel over the list, press Enter on the focused button, Tab to the editor, type and
# submit, then quit; check the log for each. Usage: native/tui/pty.sh [log-file]
set -uo pipefail
cd "$(dirname "$0")/../.."
BIN=native/probes/out/demo
L="${1:-/tmp/light-demo.log}"
rm -f "$L"
mkdir -p native/probes/out
${SCRIPTC:-npx scriptc} build native/tui/demo.js -o "$BIN" --strip --no-keep-llvm >/dev/null || { echo "build failed"; exit 1; }
( sleep 1.5; printf '\x1b[<0;4;4M\x1b[<0;4;4m'; sleep 0.4; printf '\x1b[<65;10;8M'; sleep 0.2; printf '\x1b[<65;10;8M'; sleep 0.4; printf '\r'; sleep 0.4; printf '\t'; sleep 0.2; printf 'hi'; sleep 0.2; printf '\r'; sleep 0.4; printf '\x03'; sleep 0.5 ) \
  | script -q -e -c "stty cols 80 rows 24; $BIN --log $L" /dev/null >/dev/null 2>&1
status=0
check() { if grep -q -- "$2" "$L"; then echo "ok   $1"; else echo "FAIL $1 (no '$2' in $L)"; status=1; fi; }
check "started in the pty" "started 80x24"
check "mouse click counted" "click 1"
check "wheel reached the list" "wheel 1"
check "wheel scrolled the list" "scrollTop=6"
check "enter clicked the focused button" "click 2"
check "tab then typing submitted" "submit hi"
check "quit" "quit"
echo "frames: $(grep -c ' frame ' "$L") ; binary: $(stat -c %s "$BIN") bytes"
exit $status
