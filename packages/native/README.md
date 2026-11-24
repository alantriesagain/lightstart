# @lightstart/native

The tooling of a workspace of native apps and packages, a node program (nothing here is compiled by scriptc): the commands `light` discovers from this package, `light <command>`, run from anywhere inside the workspace. It serves light's own packages and any workspace that links light (a `light` entry in its `pnpm-workspace.yaml`, light's native and terminal packages listed after it by folder, `light/packages/lib` and the rest). A member is any folder a `pnpm-workspace.yaml` pattern names that holds a `package.json`, and the workspace root itself when its `package.json` names a `native.entry` (a workspace that is one app); light itself is none. An app is a member under `apps/` or any member with a `native.entry`. In a workspace that links light, light's packages are members the others depend on and are prepared with them, and the commands that go over every member leave them to light's gates.

## A standalone project

A native project declares `@lightstart/native` and `@lightstart/build` (devDependencies): `light build` is `@lightstart/build`'s command and this package's extension takes it over for a native project, while `light test` and `light check` come from `@lightstart/light`, which the project's code depends on anyway.

A standalone project needs no `pnpm-workspace.yaml`: its project is the nearest folder at or above the start folder whose `package.json` holds a `native` block. The start folder is the command's folder, or `LIGHT_PROJECT_DIR`. Its dependencies are found through its `node_modules` (a `link:` symlink or an installed folder alike), walked as a closure in dependency order, each package's own `dependencies` and `devDependencies` resolved from its real folder.

Before a build, a test run, coverage or typecheck, the dependencies' `native.prepare` lines run in each dependency's own folder, in dependency order, each once, and then the project's own at its root, with `LIGHT_NATIVE_COMMAND` naming the command. A dependency whose real folder lies inside a `node_modules` folder is an installed package, not a link to a checkout: its prepare steps are not run, and it is reported as expected prebuilt, which is what publishing settles.

`native.ffi` and a test's `// ffi: <manifest>` resolve by package path through the project's `node_modules`, and under node the manifest folder's `*-node.mjs` stand-in is preloaded with `--import` (and `--experimental-vm-modules`, so a stand-in can run ES modules on `node:vm`). The compiler is `$SCRIPTC` when set, else `<project>/node_modules/.bin/scriptc`, else the one installed beside `@lightstart/native`, else `scriptc` on PATH. `SCRIPTC_CACHE_MAX_MB` and the other `SCRIPTC_*` variables pass through to the compiler.

## The `light` commands

A project that declares `@lightstart/native` gets these commands from `light`; each works on the project of the current folder, and with `--all` (or member names) on the members of the workspace instead. A folder with neither a native project nor `--all` is one error.

| Command | Does |
|---|---|
| `light build [--strip]` | for a native project, in place of the page build: prepare, then `scriptc build native.entry [--ffi native.ffi] -o dist/<native.binary> --no-keep-llvm` from the project's folder, keeping the symbol table so a crash's backtrace names functions; `--strip` drops it |
| `light test [--node-only] [--jobs N] [--batch N] [--timeout MS] [--all] [-- test…]` | every `test/*.test.ts` of the project (or of the workspace members, with `--all` or when a positional file names one), or the tests named, from the member's folder, under node and under `scriptc run`; both outputs must match byte for byte; tests that can share a program run up to `--batch` to one, and a run past `--timeout` milliseconds fails (Tests, below); `JOBS`, `BATCH`, `TEST_TIMEOUT` and `OPT` set the defaults |
| `light check [--all]` | the native conventions: tsconfig options, declared imports, test layout; with `--all` the workspace members light check's targets name |
| `light run [--release] [-- args…]` | build the project in scriptc's dev posture (`scriptc build native.entry --optimization dev` into `dist/dev/<native.binary>`, fast when nothing changed) and run it in the folder the command was launched from; `--release` builds the release binary in `dist/<native.binary>` instead |
| `light selftest <scenario> [--no-build]` | build the project and run one of its `native.selftests` scenarios in a pseudo-terminal |
| `light install [name]` | build the project and copy its binary into `~/.local/bin` (`BIN_DIR` overrides), atomically, then run its `native.install` lines |
| `light coverage [--apps] [--jobs N] [--all] [member…]` | scriptc's static coverage of the project's entry and, without `--apps`, of every test; with `--all` or member names, of the workspace members |
| `light typecheck [--all] [member…]` | tsc over the project's tsconfig, or with `--all` over every workspace member |
| `light prepare [--all] [member…]` | the prepare steps alone, the dependencies' first |

The compiler is light's choice (`packages/light/native/scriptc.js`): `$SCRIPTC`, else the one installed at the root (`<root>/node_modules/.bin/scriptc`), else the one beside `@lightstart/native`, else `scriptc` on PATH. scriptc caches what it built and what coverage found under `SCRIPTC_CACHE_DIR`, so an unchanged program comes back in a second (a test with the FFI manifest in a third of its time).

## The `native` block of a member's package.json

| Key | Meaning |
|---|---|
| `entry` | the app's entry, relative to the app (`src/main.ts`) |
| `binary` | the binary's name (the folder's name by default) |
| `ffi` | the FFI manifest the app links: a package path (`@lightstart/plugins/native/ffi.json`, reached through the app's `node_modules`) or a path relative to the app; an array of them is merged into one under the app's `dist/`, each library named by its absolute path |
| `prepare` | shell lines run in the member's folder before a build, a test run, coverage or typecheck, with `LIGHT_NATIVE_COMMAND` naming the command (`build`, `test`, `coverage`, `typecheck`, `desktop`, `prepare`), so a step can generate what a test run compiles apart from what a build does |
| `install` | shell lines run in the member's folder after `light install` put its binary in place, with `LIGHT_NATIVE_COMMAND=install` and `LIGHT_INSTALLED` naming the binary: what goes with it (its plugins, its data) |
| `selftests` | the selftest scenarios: `args`, `home` (files of a temp folder given through `homeEnv`), `live`, `wait`, `checks` (`[label, grep pattern]` pairs over the log), `outputChecks` (the same over what the terminal showed), `noProcessLeft`, `exitCode` (the code the app ends with, 0 by default) |
| `web`, `selftest` | a desktop app's page folder and its selftest (`wait`, `checks`) |
| `tooling` | a node-only package: no `.ts` exports, no native gate |

## Tests

A test is a plain script that prints what it checks; `test/assert.ts` of `@lightstart/test` has `ok`, `eq`, `done` and a time `budget` scaled by `TEST_TIME_SCALE`. Its first line may be `// ffi: <manifest>` (it reaches native calls bound by that manifest), `// node-only` (it walks the filesystem or does something scriptc has no reason to prove), or `// native-only` on its first two lines beside the `// ffi:` header (it runs under scriptc alone, so a native driver may be tested over its real shim while its node sibling is a separate test). Fixture paths are relative to the member: the runner's working directory is the member's folder.

A native run builds a program per test, and building is most of its time, so tests that can share one run together: a member's tests with the same `// ffi:` manifest, run under node and natively, that call `done()`. Up to `--batch` of them (`$BATCH`, 8 by default) go into one generated program in the member's `.scriptc/light-test/` (`src/batch.js`), which for each test in turn calls assert's `arm()` (the tally starts again), imports the test, waits for its `done()`, and puts back the environment variables the program started with. The program runs under node and natively like a single test, and its outputs are compared the same way. When it passes, every test in it passes; when it fails in any way (a failed check, a throw that exits, outputs that differ), its tests run again one by one, so a failure is reported as it would be alone. `--batch 1` runs every test alone, and a test named alone (`light test -- one.test.ts`) runs without a program around it. Tests in a batch share the process: a module's state, timers and handlers left by one test reach the next, so a test that passes alone and fails in its batch leaves something behind. The summary line says how many programs were run and how many batches ran again.

A run (a test's or a batch's, under node or natively) gets light test's `--timeout` in milliseconds (`$TEST_TIMEOUT`, 15 minutes by default since a native run includes its build; 0 for none): past them it is killed with every process under it and fails, its FAIL line saying it timed out, so a test that waits forever ends the run instead of holding it. A test whose node run timed out does not run natively, which would only wait as long again; a batch that timed out runs again file by file like any other failed batch, each file with its own time. Results print in file order, each as soon as the ones before it are in.
