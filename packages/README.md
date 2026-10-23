# packages

What native apps of a kind share, as workspace packages on light's native targets. Each is `@light/<folder>`, private, imported by name and declared as `workspace:*`, in light's own workspace or in one that links light. `npm run verify:packages` runs their gates; `npm run verify` includes it.

| Folder | For | Packages, in dependency order |
|---|---|---|
| `native/` | any native app | `lib`, `highlight`; `plugins`, `workspace`; `cli` (node tooling) |
| `tui/` | terminal apps, on `@bootstrapp/light/native/tui` | `test`; `kernel`, `ui`; `markdown` |

| Package | What it is |
|---|---|
| `native/lib` | What the core's modules share, light-free: dynamic data narrowed to records, text and numbers, JSON written as text, files read and written whole, the paths a walk takes, a child process run to its end with its output capped, a watcher's closer and the latest-wins ticket, a log file and the command line, NDJSON lines. |
| `native/highlight` | Syntax tokenizers (JavaScript, CSS, HTML, Markdown), a line at a time with a carried state, and the registry of languages by file extension and fence name. |
| `native/plugins` | User plugins in a native app: an embedded QuickJS (scriptc's vendored quickjs-ng behind a C shim, linked through the FFI manifest in native/), the engine that evaluates and invokes a plugin's code with a time budget, a plugin's child process with its output batched, and the sources of a plugin folder. |
| `native/workspace` | A folder as a native app works in it: its files (git's view or a capped walk), its git state read without touching the index (status, branches, the log, a commit's files, a file at HEAD), what changed against a base, a tree of the files, a watcher batching the folder's changes, a file's lines read from an offset, and a controller holding the folder's snapshots for the views. |
| `native/cli` | The tooling of a workspace of native apps and packages compiled by scriptc: build, run, selftest, test, coverage, typecheck, check and install. |
| `tui/test` | What a member's tests share: the assertions that print what they check, and a headless screen for a light view. |
| `tui/kernel` | The plugin kernel of a native app: plugins ordered by what they require, slash commands, named actions with default keys, layered keymaps, payload-less hooks, settings and kept state. |
| `tui/ui` | What the terminal views of the packages share: the palette the process draws with, durations as the views write them, word wrap over styled runs, the windowed list in the palette's colors, and the clipboard. |
| `tui/markdown` | Markdown as terminal lines: a line of prose to styled runs (emphasis, code, links, headings, lists, code blocks colored by the tokenizers) and a table laid out in columns. |

A package never imports one after it in that order, nor an app. `lib` and `highlight` reach nothing of light; `kernel` reaches only the type of a key event.

## A member

- A `package.json` with `"type": "module"` and `"private": true`, and `exports` of `{ ".": "./index.ts", "./*": "./*" }`: every export target is a `.ts` file, which is what lets scriptc compile a bare import of a linked package as program source (a `.js` target would make it an npm package and fail the build).
- Every member and `@bootstrapp/light` it imports declared as `workspace:*`; `@light/test` and `@types/node` are devDependencies. Imports are by name (`@bootstrapp/light/native/tui`, `@bootstrapp/light/native/tui/lines.ts`, `@light/lib/json.ts`); a relative import never leaves the member.
- A `tsconfig.json` equal to `native/cli/templates/tsconfig.json`: scriptc reads the one nearest an app's entry for the whole program, so every member typechecks under the same options.
- A `README.md`, and `test/*.test.ts`: plain scripts on `@light/test/assert.ts`, run from the member's folder under node and natively, the outputs equal. A test's first line may be `// ffi: <manifest>` (it reaches native calls the manifest binds; under node the manifest folder's stand-in is preloaded) or `// node-only`.
- A `native` block for what the tools need: a package's prepare steps (`@light/plugins` builds its QuickJS archive), an app's entry, binary, FFI manifest and selftests (`native/cli/README.md`).
- The code follows light's rules for code that compiles statically (`light/native/README.md`) and light's comment rule: a JSDoc module header, JSDoc on an exported symbol or a JSDoc type, nothing else.

`light-native check --all` holds the members to this layout.

## A workspace that links light

An app's own repository links light beside it and lists light's packages as members, so its packages and apps import them by name:

```yaml
packages:
  - 'light'
  - 'light/packages/native/*'
  - 'light/packages/tui/*'
  - 'packages/*'
  - 'apps/*'
```

with `light` a symbolic link to light's checkout. The tools there (`light-native`, from `@light/cli`) prepare light's packages with the members that depend on them and leave their tests and coverage to light's gates.
