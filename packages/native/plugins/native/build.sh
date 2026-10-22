#!/usr/bin/env bash
# The plugins' QuickJS: scriptc's vendored quickjs-ng and the shim (wcjs.c) as native/out/libwcjs.a,
# which the FFI manifest (ffi.json) links. scriptc's runtime links its own copy of QuickJS's regex
# and Unicode code, and libregexp calls hooks its host defines (lre_realloc, lre_check_timeout,
# lre_check_stack_overflow); so this copy's every exported regex, Unicode and number-conversion
# symbol is renamed qjs_*, keeping the two apart. Builds again only when a source is newer.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd -P)"
root="$(cd "$here/../../../.." && pwd -P)"
quickjs="${QUICKJS_DIR:-$root/../scriptc/packages/runtime/vendor/quickjs-ng}"
out="$here/out"
lib="$out/libwcjs.a"
sources=(quickjs.c libregexp.c libunicode.c dtoa.c)
fresh=1
[ -f "$lib" ] || fresh=0
for s in "${sources[@]}"; do [ "$quickjs/$s" -nt "$lib" ] && fresh=0; done
[ "$here/wcjs.c" -nt "$lib" ] && fresh=0
[ "$here/build.sh" -nt "$lib" ] && fresh=0
if [ "$fresh" = 1 ]; then exit 0; fi
mkdir -p "$out/plain" "$out/renamed"
cc=${CC:-cc}
flags=(-std=gnu11 -O2 -funsigned-char -D_GNU_SOURCE -DQUICKJS_NG_BUILD -w -I"$quickjs")
# First pass: what the regex, Unicode and number code exports, and the hooks quickjs.c defines for it.
for s in "${sources[@]}"; do "$cc" "${flags[@]}" -c "$quickjs/$s" -o "$out/plain/${s%.c}.o"; done
{
  for o in libregexp libunicode dtoa; do nm -g --defined-only "$out/plain/$o.o" | awk 'NF==3{print $3}'; done
  nm -g --defined-only "$out/plain/quickjs.o" | awk 'NF==3{print $3}' | grep -E '^(lre_|cr_|unicode_)'
} | sort -u | awk '{print "#define " $1 " qjs_" $1}' > "$out/rename.h"
# Second pass: everything with those names prefixed, and the shim.
for s in "${sources[@]}"; do "$cc" "${flags[@]}" -include "$out/rename.h" -c "$quickjs/$s" -o "$out/renamed/${s%.c}.o"; done
"$cc" "${flags[@]}" -Wall -c "$here/wcjs.c" -o "$out/renamed/wcjs.o"
rm -f "$lib"
ar rcs "$lib" "$out/renamed"/*.o
echo "built $lib ($(du -h "$lib" | cut -f1), $(wc -l < "$out/rename.h") symbols renamed)"
