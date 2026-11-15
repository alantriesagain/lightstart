#!/usr/bin/env bash
# The crash report (crash.c) as native/out/libcrash.a, which the FFI manifest (ffi.json) links.
# Builds again only when a source is newer.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd -P)"
out="$here/out"
lib="$out/libcrash.a"
[ "$here/crash.c" -nt "$lib" ] || [ "$here/build.sh" -nt "$lib" ] || { [ -f "$lib" ] && exit 0; }
mkdir -p "$out"
cc=${CC:-cc}
"$cc" -std=gnu11 -O2 -Wall -Wextra -c "$here/crash.c" -o "$out/crash.o"
rm -f "$lib"
ar rcs "$lib" "$out/crash.o"
echo "built $lib ($(du -h "$lib" | cut -f1))"
