# @light/cli

The tooling of a workspace of native apps and packages, a node program (nothing here is compiled by scriptc): `light-native <command>`, run from anywhere inside the workspace (the root's scripts, or `pnpm exec light-native …`). It serves light's own packages and any workspace that links light (a `light` entry in its `pnpm-workspace.yaml`, light's packages listed after it as `light/packages/native/*` and `light/packages/tui/*`). A member is any folder a `pnpm-workspace.yaml` pattern names that holds a `package.json`; light itself is none. In a workspace that links light, light's packages are members the others depend on and are prepared with them, and the commands that go over every member leave them to light's gates.

| Command | Does |
|---|---|
| `light-native prepare [member…]` | the prepare steps (`native.prepare`, shell lines run in the member's folder) of the members named, every app by default, and of the members they depend on, each once |
| `light-native build <app>` | prepare, then `scriptc build <native.entry> [--ffi <native.ffi>] -o dist/<native.binary> --strip --no-keep-llvm` from the app's folder |
| `light-native run <app> [--no-build] [-- flags…]` | build, then run the binary in the folder the command was launched from, logging to `$NATIVE_LOG` (else `/tmp/<binary>.log`), with `CLAUDECODE` and `CLAUDE_CODE_ENTRYPOINT` unset |
| `light-native selftest <app> <scenario> [--no-build]` | build, then run the scenario (`native.selftests.<name>`) in a 200x40 pseudo-terminal on a temp git repository with `--trust --selftest <name>`, and check the log; `live` scenarios run only with `NATIVE_LIVE=1` |
| `light-native test [member…] [--node-only] [--jobs N] [--opt dev\|release] [-- test…]` | every `test/*.test.ts` of the members (every member with a `test/` folder by default), or the tests named after `--`, from the member's folder, under node and under `scriptc run`; both outputs must match byte for byte |
| `light-native coverage [member…] [--jobs N] [--apps]` | `scriptc coverage --print=diagnostics --fail-on=slow-paths` of every app entry and (unless `--apps`) every test, read by light's `packages/light/native/diagnostics.js` gate: each must compile fully statically, with no slow path, no divergence from node and no deferred or unreached site; a step's gate covers the apps, `pnpm verify` everything |
| `light-native typecheck --all \| <member…>` | `tsc -p tsconfig.json` per member, after its prepare steps; errors in files outside the member are reported apart and do not count; a member with sources and no tsconfig fails |
| `light-native probes` | the compiler probes in the workspace's `probes/` (light's own are in `packages/light/native/probes/`, with their runner): coverage, build, node against native, written to `probes/RESULTS.md` |
| `light-native install <app> [name]` | build and copy the binary into `~/.local/bin` (`BIN_DIR` overrides), atomically |
| `light-native desktop <app> [--selftest]` | build a desktop app with light's desktop shell (`native.web` the page) into its dist/ and run it, or its `native.selftest` |

The compiler is light's choice (`packages/light/native/scriptc.js`): `$SCRIPTC`, else the fork's `scriptc-dev` on PATH, else the one installed at the root, else `scriptc` on PATH. scriptc caches what it built and what coverage found under `SCRIPTC_CACHE_DIR`; the fork's wrapper names that directory by the fork's commit and its build's time, so a rebuilt compiler never replays what the one before built, and an unchanged program comes back in a second (a test with the FFI manifest in a third of its time).

## The `native` block of a member's package.json

| Key | Meaning |
|---|---|
| `entry` | the app's entry, relative to the app (`src/main.ts`) |
| `binary` | the binary's name (the folder's name by default) |
| `ffi` | the FFI manifest the app links: a package path (`@light/plugins/native/ffi.json`, reached through the app's `node_modules`) or a path relative to the app |
| `prepare` | shell lines run in the member's folder before a build, a test run, coverage or typecheck |
| `selftests` | the selftest scenarios: `args`, `home` (files of a temp folder given through `homeEnv`), `live`, `wait`, `checks` (`[label, grep pattern]` pairs), `noProcessLeft`, `exitCode` (the code the app ends with, 0 by default) |
| `web`, `selftest` | a desktop app's page folder and its selftest (`wait`, `checks`) |
| `tooling` | a node-only package: no `.ts` exports, no native gate |

## Tests

A test is a plain script that prints what it checks; `test/assert.ts` of `@light/test` has `ok`, `eq`, `done` and a time `budget` scaled by `TEST_TIME_SCALE`. Its first line may be `// ffi: <manifest>` (it reaches native calls bound by that manifest; under node the manifest folder's `*-node.mjs` is preloaded) or `// node-only` (it walks the filesystem or does something scriptc has no reason to prove). Fixture paths are relative to the member: the runner's working directory is the member's folder.
