# @lightstart/cli

The command runner behind the `light` binary: commands, hooks, routes and command extensions come from a static table and from the `cli/` folders of the project and of every installed package in the project's scopes. The core is runtime-neutral and compiles fully statically with [scriptc](https://github.com/vercel-labs/scriptc); walking folders and loading files with `import()` lives in the node-only `node/` entry. Discovery lists files and imports none: a file is loaded when it is needed. TypeScript with no build step, no runtime dependencies.

The `light` commands `test`, `check`, `desktop` and `classes:bake` are files under `packages/light/cli/commands/`, found by discovery. `serve` comes from `@lightstart/dev` and `build` from `@lightstart/build`, each in its own `cli/commands/` folder. `packages/light/bin/light.js` forwards to this package for one release: when `@lightstart/cli` is installed it runs this CLI, otherwise it keeps the old dispatch and says on stderr where the commands moved.

```bash
light serve --watch
light test test/browser.test.js
light check
light --help
light serve --help
```

## Running a CLI

`createCli` answers a `main(argv, out?)` that runs one argv and resolves the exit code. `--quiet`, `--verbose`, `--debug`, `--help`/`-h` and `--version`/`-v` are split out of the argv anywhere before a `--`; everything else, and everything after `--`, stays for the command. Help with no command lists every command grouped by the source that contributed it.

| Flag | Effect |
|---|---|
| `--help`, `-h` | Help for the CLI, or for the command it follows |
| `--version`, `-v` | The CLI version |
| `--quiet` | Errors only |
| `--verbose`, `--debug` | Debug output |

| Variable | Effect |
|---|---|
| `<PREFIX>_PROJECT_DIR` | The project root (default: the shell's logical working directory) |
| `<PREFIX>_LOG_LEVEL` | `debug`, `log`, `warn`, `error` or `silent`; wins over the flags |
| `NO_COLOR` | No ANSI colour |

The prefix is the `envPrefix` given to `createCli` (`LIGHT` for the `light` binary). Before discovery it loads `<projectDir>/.env` into `process.env`: a variable already set wins, quotes around a value are stripped, `#` lines are skipped.

The project folder is the shell's logical path, not `process.cwd()`'s realpath, so a symlinked workspace member keeps the path the shell names.

## The `cli/` convention

A project or a package contributes by putting files under `cli/`. Nothing is registered anywhere: the folder is the API.

```
cli/
├── commands/
│   ├── build.ts             # light build
│   └── content/
│       └── add.ts           # light content:add
├── extend/
│   └── serve.ts             # extension of the "serve" command
├── routes/
│   └── api.ts               # dev-server routes
└── hooks/
    └── serve.after.ts       # the hook "serve:after"
```

`commands/<a>/<b>.ts` is the command `<a>:<b>`; `hooks/<a>.<b>.ts` is the hook `<a>:<b>`; `extend/<a>.ts` extends the command `<a>`. `.ts`, `.js` and `.mjs` files are found the same way, `.test.` files are skipped, and each folder is read sorted. A command file default-exports a `Command`, a hook file a handler function, a route file an app function, and an extension file a `defineExtension()` value.

A project's `server/routes/` are routes too, loaded after its `cli/routes/`.

### Commands

```ts
import { defineCommand } from "@lightstart/cli";

export default defineCommand({
  description: "Build the project",
  usage: "light build [project] [--mode <m>] [--watch]",
  aliases: ["b"],
  args: {
    project: { positional: true, description: "Project dir (default: cwd)" },
    mode: { default: "hybrid", choices: ["hybrid", "ssg", "spa"] as const },
    watch: { flag: true, short: "w" },
    picks: { positional: true, rest: true },
  },
  async run(ctx, { project, mode, watch, picks }) {
    ctx.log.log(`Building ${project ?? ctx.projectDir} as ${mode}`);
    return 0;
  },
});
```

`defineCommand` is an identity wrapper that keeps the literal's inferred argument types:

| Spec | Resolves to |
|---|---|
| `{ flag: true }` | `boolean` (`false` unless given; `--no-<name>` sets it `false`) |
| `{ positional: true, rest: true }` | `string[]` |
| `{ choices: [...] as const }` | the union of the choices |
| `{ required: true }` or `{ default: "x" }` | `string` |
| anything else | `string \| undefined` |

A returned number is the exit code; nothing is 0. `usage` overrides the rendered usage line, `aliases` adds names the registry resolves, and `hidden: true` keeps a command out of the help list.

The parser: `--port 3000` or `--port=3000`; one-letter shorts that group (`-wo`) and take their value attached or next (`-p3000`, `-p 3000`); `--no-watch` negates a flag; `--` ends the options; positionals by declaration order, and the last may take the rest. An unknown option, a stray positional, a value outside `choices` or a missing required argument is an error with the command's usage (exit 2). A schema that contradicts itself (a default outside its choices, `required` with a `default`, a shared or multi-letter short, a rest positional that is not last) throws before any argv is read.

### The command context

`run(ctx, args)` receives:

| Field | What |
|---|---|
| `projectDir` | The project root |
| `cliDir` | The folder of this package |
| `cwd` | The shell's logical working directory |
| `argv` | The command's argv after the global flags |
| `log` | `log`, `debug`, `warn`, `error`, filtered at the resolved level and tagged with the source |
| `env` | `process.env` |
| `cli` | `runCommand(name, args?)`, `runHook(name, payload)`, `listCommands()`, `loadRoutes()`, `extend(name, api)` |
| `formatBytes` | A byte count as `"1.5 MB"` |

Exit codes: a command's own number, 0 when it returns nothing, 1 for an unknown command (with a line saying how to see the help) or a thrown error, 2 for an argument error.

## createCli

```ts
import { createCli } from "@lightstart/cli";
import { discover } from "@lightstart/cli/node";

const cli = createCli({
  name: "acme",
  version: "1.2.3",
  scopes: ["@acme", "@lightstart"],
  envPrefix: "ACME",
  commands,
  packages,
  discover,
});
process.exitCode = await cli.main(process.argv.slice(2));
```

| Option | What |
|---|---|
| `name` | The CLI name in help and in the usage line |
| `version` | What `--version` prints |
| `scopes` | The npm scopes the binary always scans (`@lightstart` for `light`); discovery appends `light.scopes` from the project and its workspace root |
| `envPrefix` | The prefix of `_PROJECT_DIR` and `_LOG_LEVEL` |
| `commands` | A static table of commands; each wins its name over a discovered one |
| `packages` | Extra package names to scan under the project's `node_modules` |
| `discover` | A `Discoverer`; without one only the static table answers |

`splitGlobals(argv)`, `defineCommand`, the `Registry`, `runCommand`, `buildContext`, the parser, logger, env helpers and the public types are exported from `@lightstart/cli`. Discovery and file-system helpers are in `@lightstart/cli/node`.

## Hooks

A hook file default-exports a handler `(ctx, payload) => teardown | void`. Every package's file for a hook runs, in discovery order, each in its own try/catch: a handler that throws is warned with its source and counted, and the next one still runs. A returned function is a teardown; `teardown()` on the run result calls them last-registered first, each isolated.

```ts
const after = await ctx.cli.runHook("serve:after", payload);
after.ran;
after.failed;
await after.teardown();
```

`runHook` answers `{ ran, failed, teardown() }`. The hooks and their payload types are declared by adding to the `Hooks` interface by declaration merging:

```ts
import type { CommandContext } from "@lightstart/cli";

declare module "@lightstart/cli" {
  interface Hooks {
    "serve:before": (ctx: CommandContext, payload: { port: number }) => void;
  }
}
```

`HookName` is then the keys of `Hooks`, and `HookPayload<"serve:before">` is the handler's second parameter. With no declaration, `HookName` is `string` and the payload is `unknown`. A new hook is a new entry; there is no priority.

## Extensions

A package extends an existing command with `cli/extend/<command>.ts`, default-exporting `defineExtension("<command>", { args?, setup })`:

```ts
import { defineExtension } from "@lightstart/cli";

export default defineExtension("serve", {
  args: { preview: { flag: true, description: "Also start the build preview" } },
  setup(ctx, args, api) {
    if (args.preview) api.preview = true;
  },
});
```

`args` are merged into the command's own before its argv is parsed, and help for the command lists them under the extension's source. A name the command or an earlier extension already declares is an error naming both sources; the command does not run and the exit code is 2. Every extension of a command runs in discovery order, each in its own try/catch: a setup that throws is an error naming its source and the command exits 1.

The command opens what its engine has at the point it is ready, by calling `await ctx.cli.extend("<command>", api)`. The runner then runs each extension's `setup(ctx, parsedArgs, api)`, in discovery order. `api` is typed per command by declaration merging on the `Extensions` interface, as hooks are on `Hooks`:

```ts
declare module "@lightstart/cli" {
  interface Extensions {
    serve: { preview?: boolean };
  }
}
```

A command nobody extends gets `extend` as a no-op. Extension files are imported when their command runs or its help is asked for; global help imports none.

## Routes

A route file default-exports an app function. The project's own `server/routes/` are loaded after its `cli/routes/`. `ctx.cli.loadRoutes()` imports every route file, in tier order, and answers their default exports, typed `readonly unknown[]` until the dev-server package of a later phase gives them their type. A file whose default export is not a function is warned and skipped; one that fails to import never aborts the run.

## Discovery

`@lightstart/cli/node`'s `discover` lists files in tiers, in this order, and imports none of them:

1. `<project>/cli/` or the roots its `light.cli` names, and `<project>/server/routes/`
2. the scoped packages under `<project>/node_modules/<scope>/*`, alphabetically
3. the scoped packages under the workspace root's `node_modules/<scope>/*`
4. each name in `packages`, at `<project>/node_modules/<name>`
5. this CLI's own installed `<cliDir>/node_modules/<scope>/*`

The scopes are the `scopes` the binary was built with plus `light.scopes` in the project's `package.json` and in its workspace root's, so a workspace declares them once for every member. `light.packages` names unscoped packages the same way; each is looked up under the project's `node_modules`, then the workspace root's, and scanned by its `light.cli` roots. The workspace root is the nearest folder at or above the project holding a `pnpm-workspace.yaml` or a `package.json` with `workspaces`. `cliDir` defaults to `@lightstart/cli`'s folder, so a binary built on `createCli` scans the packages installed beside itself. A package folder is scanned once, by its real path.

A package that is a set of areas names them in `light.cli`:

```json
"light": { "scopes": ["@acme"], "cli": ["events", "tools"] }
```

That package contributes `<pkg>/events/cli/` and then `<pkg>/tools/cli/` instead of `<pkg>/cli/`. Its sources are named `<package name>/events` and `<package name>/tools`.

A command name belongs to the first tier that declares it; a later declaration warns and is ignored. A static command from `createCli` wins over both. Every hook, route and extension is kept, in tier order. Sources are named `<project>` for the project, by their `package.json` name for packages, and by package and folder when `light.cli` names roots; help groups commands by that name.

A file is imported when it is needed: a command when it runs or when help needs its description (global help imports every listed command, `<cmd> --help` only that one), a hook when it is first dispatched, a route when `loadRoutes()` is called, an extension when its command runs or asks for its help. A command file that fails to import warns and is skipped in help; running it is an error and exits 1.

## Native

The core (`index.ts`, `argv.ts`, `registry.ts`, `runner.ts`, `help.ts`, `log.ts`, `env.ts`, `format.ts`, `hooks.ts`, `types/`) compiles fully statically with scriptc. `node/` is node-only: it walks folders and loads files with `import()` of a computed path, which scriptc 0.4.12 does not compile, and a table of lazy `() => import()` loaders throws when called. The core gets its lazy loading through a `FileLoader` object the node layer supplies; a CLI with no discovery passes none and answers only its static table.

A native binary registers its commands in a static table instead. `native/light.ts` is that entry: `version` and `echo`, no discovery. A package names its entry and binary in `package.json`:

```json
"native": { "entry": "native/light.ts", "binary": "light" }
```

Build `@lightstart/cli` into `packages/cli/dist/light`:

```bash
node packages/native/cli/bin/light-native.js build @lightstart/cli
```

[`benchmarks/cli/`](../../benchmarks/cli/README.md) measures the binary against the node entry.

## Packaging

`npm run pack` in this folder runs `scripts/pack.js`: it stages the package into `dist/`, turns each TypeScript module into JavaScript (types stripped in place, so lines and columns match) with a `.d.ts` beside it, rewrites relative `.ts` specifiers to `.js`, and writes a `package.json` whose exports name both. Tests, scripts and the native `dist/` are left out.
