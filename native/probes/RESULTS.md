# Probe results (2026-10-20T15:42Z, scriptc 0.3.6, node v25.3.0)

## p-a-dispatch: PASS
- coverage rc=0 static=64 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-aa-fetch: PASS
- coverage rc=0 static=36 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ab-text: PASS
- coverage rc=0 static=21 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ac-process: PASS
- coverage rc=0 static=13 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ad-stdin-lines: PASS
- coverage rc=0 static=36 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ae-model: PASS
- coverage rc=0 static=986 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-af-controller: PASS
- coverage rc=0 static=1914 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ag-prop-signal: PASS
- coverage rc=0 static=204 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ah-classes-engine: PASS
- coverage rc=0 static=951 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ai-theme-tokens: PASS
- coverage rc=0 static=239 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-aj-ts-controller: PASS
- coverage rc=0 static=1472 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ak-ts-model: PASS
- coverage rc=0 static=943 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-b-host: PASS
- coverage rc=0 static=77 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-d-signals: PASS
- coverage rc=0 static=209 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-g1-generic-class: PASS
- coverage rc=0 static=22 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-g2-generic-subclass: FAIL
- coverage rc=0 static=24 (100%) fully=true deferred=false
- build rc=1 node rc=0 native rc=-1 same output=false
```
scriptc coverage /home/alanleal/Projects/light/native/probes/p-g2-generic-subclass.js

  statements analyzed   24
  compile statically    24  (100%)

  fully static — all analyzed statements compile to native code.
--- build
/home/alanleal/Projects/light/native/probes/p-g2-generic-subclass.js:26:1 - error SC9001: internal compiler error: class Lazy%0: generic family "Lazy" has an incompatible prefix — please report this

  25 |  */
  26 | class Lazy extends Box {
     | ^~~~~~~~~~~~~~~~~~~~~~~~
  27 |   /** @param {() => T} fn */

/home/alanleal/Projects/light/native/probes/p-g2-generic-subclass.js:26:1 - error SC9001: internal compiler error: class Lazy%1: generic family "Lazy" has an incompatible prefix — please report this

  25 |  */
  26 | class Lazy extends Box {
     | ^~~~~~~~~~~~~~~~~~~~~~~~
  27 |   /** @param {() => T} fn */

2 errors.
--- node
42 ab 42 true
--- native
(build failed)
```

## p-g3-nongeneric-base: PASS
- coverage rc=0 static=61 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-g4-generic-composition: PASS
- coverage rc=0 static=23 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-h-queue: PASS
- coverage rc=0 static=104 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-i-handlers: FAIL
- coverage rc=0 static=65 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=false
```
scriptc coverage /home/alanleal/Projects/light/native/probes/p-i-handlers.js

  statements analyzed   65
  compile statically    65  (100%)

  fully static — all analyzed statements compile to native code.
--- build
/home/alanleal/Projects/light/native/probes/out/p-i-handlers
--- node
arrow:a | function:b | direct:c | noowner:d | base:change:e | unknown:f
string:2 | boolean:true | string:2 | boolean:true
--- native
arrow threw expected ChangeEvent at $[0], got object | function threw expected ChangeEvent at $[0], got object | direct:c | noowner threw expected ChangeEvent at $[0], got object | base:change:e | unknown:f
string:2 | boolean:true | string:2 | boolean:true
```

## p-j-map-entries: PASS
- coverage rc=0 static=226 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-k-map-union: PASS
- coverage rc=0 static=38 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-l-char-assign: PASS
- coverage rc=0 static=16 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-m-dispatch-unknown: FAIL
- coverage rc=0 static=33 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=false
```
scriptc coverage /home/alanleal/Projects/light/native/probes/p-m-dispatch-unknown.js

  statements analyzed   33
  compile statically    33  (100%)

  fully static — all analyzed statements compile to native code.
--- build
/home/alanleal/Projects/light/native/probes/out/p-m-dispatch-unknown
--- node
type=change | got narrowed | type=change | got original | got base
--- native
type=change | got narrowed | type=change | got original | base threw expected ChangeEvent at $[0], got object
```

## p-n-alloc: FAIL
- coverage rc=0 static=55 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=false
```
scriptc coverage /home/alanleal/Projects/light/native/probes/p-n-alloc.js

  statements analyzed   55
  compile statically    55  (100%)

  fully static — all analyzed statements compile to native code.
--- build
/home/alanleal/Projects/light/native/probes/out/p-n-alloc
--- node
one-field class: 7.4 ms
seven-field class: 12.3 ms
three-level subclass with an array field: 11.9 ms
two-level subclass with an array field: 6.0 ms
object literal: 3.2 ms
small array: 4.3 ms
one-field class, dropped: 8.8 ms
empty array field only: 2.0 ms
--- native
one-field class: 15.7 ms
seven-field class: 3.9 ms
three-level subclass with an array field: 12.7 ms
two-level subclass with an array field: 6.0 ms
object literal: 0.7 ms
small array: 4.2 ms
one-field class, dropped: 3.6 ms
empty array field only: 1.5 ms
```

## p-o-subclass-field: PASS
- coverage rc=0 static=52 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-p-override: PASS
- coverage rc=0 static=63 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-q-override-order: PASS
- coverage rc=0 static=63 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-r-virtual-site: PASS
- coverage rc=0 static=62 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-s-leaf-class: PASS
- coverage rc=0 static=39 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-t-ffi: PASS
- coverage rc=0 static=57 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-u-crypto: PASS
- coverage rc=0 static=9 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-v-http: PASS
- coverage rc=0 static=39 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-w-sync-fs: PASS
- coverage rc=0 static=30 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-x-watch-many: PASS
- coverage rc=0 static=36 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-y-json-shapes: PASS
- coverage rc=0 static=53 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-z-spawn-kill: PASS
- coverage rc=0 static=31 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true
