# Probe results (2026-10-12T20:45Z, scriptc 0.2.10, node v25.3.0)

## p-a-dispatch: PASS
- coverage rc=0 static=64 (100%) fully=true deferred=false
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

  fully static — this program has no dynamic remainder.
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
