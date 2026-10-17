# Probe results (2026-10-17T21:27Z, scriptc 0.3.6, node v25.3.0)

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

## p-af-controller: FAIL
- coverage rc=0 static=1897 (99%) fully=false deferred=false
- build rc=0 node rc=0 native rc=0 same output=true
```
scriptc coverage /home/alanleal/Projects/light/native/probes/p-af-controller.js

  statements analyzed   1898
  compile statically    1897  (99%)

  in unreached code   (never lowered — cannot fail a build)
      ×1  SC1090  references to 'this' in object literal methods
          at controller/resource.ts:235:7
          hint: this form is valid TypeScript but does not compile yet — rewrite it with a supported equivalent of the construct the message names (https://scriptc.dev/limitations lists the boundary)
--- build
/home/alanleal/Projects/light/native/probes/out/p-af-controller
--- node
all write the probe | run it
open run it
done write the probe
--- native
all write the probe | run it
open run it
done write the probe
```

## p-ag-prop-signal: PASS
- coverage rc=0 static=204 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ah-classes-engine: PASS
- coverage rc=0 static=951 (100%) fully=true deferred=false
- build rc=0 node rc=0 native rc=0 same output=true

## p-ai-theme-tokens: PASS
- coverage rc=0 static=239 (100%) fully=true deferred=false
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
one-field class: 15.4 ms
seven-field class: 24.0 ms
three-level subclass with an array field: 33.0 ms
two-level subclass with an array field: 11.8 ms
object literal: 7.1 ms
small array: 7.2 ms
one-field class, dropped: 13.6 ms
empty array field only: 5.1 ms
--- native
one-field class: 52.0 ms
seven-field class: 14.2 ms
three-level subclass with an array field: 55.7 ms
two-level subclass with an array field: 17.1 ms
object literal: 1.4 ms
small array: 9.4 ms
one-field class, dropped: 10.5 ms
empty array field only: 3.7 ms
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
