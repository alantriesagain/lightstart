# Working on @lightstart/cli

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `createCli`, `splitGlobals`, the `Hooks`/`HookName`/`HookPayload`/`HookRun`/`HookTeardown` types, the `Extensions` family, and the package's exports |
| `argv.ts` | `parseArgs`, `ArgError`, `SchemaError`: the parser behind every command |
| `registry.ts` | The static table and the discovered files, merged; commands, hooks, routes and extensions are imported on first need |
| `runner.ts` | `runCommand`, `buildContext`: load extensions, merge their args, parse, build the context, answer the exit code |
| `help.ts` | `renderHelp`: the global list grouped by source, and one command's help with its extensions |
| `log.ts`, `env.ts`, `format.ts`, `hooks.ts` | The logger and its levels, `.env` and the logical cwd, `formatBytes`, `hookNameOf` |
| `types/` | `Command`/`ArgSpec`/`ResolvedArgs`, `CommandContext`/`CliApi`/`Logger`, the discovery records and `FileLoader`, the extension types and `defineExtension` |
| `node/` | Discovery: `walkFiles`, the scoped packages, the workspace root, the `light` manifest, `discover`, `NodeFileLoader`, `importFile`. Node-only |
| `bin/light.js` | The `light` binary: `createCli` with `discover` |
| `native/light.ts` | The native entry: `createCli` with a static command table, no discovery |
| `scripts/pack.js` | What npm gets: JavaScript with a `.d.ts` per module (`npm run pack`, into `dist/`) |
| `test/` | Plain scripts on `@light/test/assert.ts`, under node and natively, the outputs equal |
| `package.json` | `bin`, `exports`, and the `native` entry and binary name |

## Rules the sources keep

The core is compiled as program source by scriptc, so it follows light's native rules (`packages/light/native/probes/README.md`) and the ones [packages/server/AGENTS.md](../server/AGENTS.md) lists. This package adds:

- The core has no `import()`: a computed path only reaches an import in `node/discover.ts`, through `NodeFileLoader`. The core's `FileLoader` is a class with a method; discovery records hold file paths, sources and a command name, never functions. Adding a dynamic import to the core makes the native build fail or the binary throw.
- A command or extension built in a program scriptc compiles names the general schema, `defineCommand<ArgsSchema>(…)` and `defineExtension<"<command>", ArgsSchema>(…)`: natively a literal schema does not convert to `ArgsSchema` (SC2003). Under node the literal's own types are kept.
- A native binary registers its commands in the static table (`native/light.ts`) and has no discovery. Discovery is node-only because scriptc 0.4.12 does not compile `import()` of a computed path and a table of lazy `() => import()` loaders throws when called.
- Discovery lists files and imports none. A command is imported when it runs or help names it, a hook on its first dispatch, a route on `loadRoutes()`, an extension when its command runs or its help is asked for. The registry caches a successful load and a bad default export; a command import failure throws `LoadError` and the runner answers 1.
- The parser collects values in a `Map` and makes the result record once with `Object.fromEntries`, so no write uses a computed string key. Empty maps are typed where they are declared.
- The logger writes through an injected `LogWriter`, never by reassigning `console`; the tests pass a writer that keeps its lines.
- Tests are plain scripts on `@light/test/assert.ts`, not a test framework. They run under node and natively and must print the same thing: compare numbers with `eqn`, strings and JSON with `eq`, booleans with `ok`, errors with `throws`. A node-only test starts with `// node-only` (`test/env.test.ts`, `test/discover.test.ts`); it is left out of the native and coverage runs.
- `bin/light.js` and `native/light.ts` set `process.exitCode` and let the program end; they never call `process.exit`.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only. The package ships its sources to node and the stripped JavaScript to npm; both must run without a build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `createCli({ name, version, scopes, envPrefix, commands?, packages?, discover? })` answering `{ main }`, and `splitGlobals` | a binary of another name built on the same runner, with its own scopes and variables |
| `@lightstart/cli` exporting `defineCommand`, `defineExtension` and the command/extension types; `@lightstart/cli/node` exporting `discover` | `packages/light/cli/commands/*.js`, the command files discovery finds; `packages/light/bin/light.js`, the forwarder that runs `createCli` with `discover` until the next release |
| The `cli/` shapes: a command default-exports a `Command`, a hook a handler, a route an app function, an extension a `defineExtension()` value; `commands/a/b` is `a:b`, `hooks/a.b` is `a:b` and `extend/a` extends `a` | light's command files and any project or package that contributes under `cli/` |
| `ctx.cli.extend("<command>", api)` running every extension's `setup(ctx, parsedArgs, api)` in discovery order, once the command is ready; no extensions is a no-op | the command packages that open themselves to extensions, and the extension packages that receive the api |
| The `Extensions` interface widened by declaration merging, typing each command's api | extension packages that import `defineExtension` |
| `ctx.cli.runHook` answering `HookRun` with `ran`, `failed` and `teardown()`; handler teardowns run last first and isolated | server and serve packages that dispatch hooks |
| `ctx.cli.loadRoutes()` answering every route's default export in discovery order | the dev-server package of a later phase, which types and serves them |
| Discovery order is project `cli/`, the project's scoped packages, the workspace root's scoped packages, `packages`, the CLI's own scoped packages; a static command wins its name | help grouping and duplicate warnings, and a binary that scans more than one scope |
| `light.scopes` and `light.cli` in a `package.json`, and `discover`'s `cliDir`, which defaults to this package's folder | a project naming the scopes it ships; a package that is a set of areas; a binary scanning beside itself |
| `package.json`'s `native.entry` and `native.binary` | `light-native build @lightstart/cli`, which writes `dist/light` |

## Gates

From the repository root:

```bash
node packages/native/cli/bin/light-native.js test @lightstart/cli       # node and native, outputs equal
node packages/native/cli/bin/light-native.js coverage @lightstart/cli   # every test fully static, node-only left out
node packages/native/cli/bin/light-native.js typecheck @lightstart/cli
node packages/native/cli/bin/light-native.js build @lightstart/cli      # dist/light
node packages/native/cli/bin/light-native.js check --all
npx eslint packages/cli
node benchmarks/cli/run.js                     # node and native stdout equal, then the ratios
```

The benchmark in [`benchmarks/cli/`](../../benchmarks/cli/README.md) compares the native binary with the node entry; its README names the command and what it measures.
