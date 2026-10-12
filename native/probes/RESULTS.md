# Probe results (2026-10-12T22:25Z, scriptc 0.2.10, node v25.3.0)

## p-m-dispatch-unknown: FAIL
- coverage rc=0 static=30 (96%) fully=false deferred=true
- build rc=0 node rc=0 native rc=0 same output=false
```
scriptc coverage /home/alanleal/Projects/light/native/probes/p-m-dispatch-unknown.js

  statements analyzed   31
  compile statically    30  (96%)

  deferred to runtime   1 site (JS statements that throw their fence if executed)
      ×1  SC1090  string conversions of unions with object arms (narrow first: check a discriminant field, or compare with '!== undefined'/'!== null' for unit arms)
          at native/probes/p-m-dispatch-unknown.js:75:15
          hint: this form is valid TypeScript but does not compile yet — rewrite it with a supported equivalent of the construct the message names (https://scriptc.dev/limitations lists the boundary)
--- build
/home/alanleal/Projects/light/native/probes/out/p-m-dispatch-unknown
--- node
type=change | got narrowed | type=change | got original | got base
--- native
type=change | got narrowed | type=change | got original | base threw expected ChangeEvent at $[0], got object
```
