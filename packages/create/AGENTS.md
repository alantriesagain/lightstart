# Working in @lightstart/create

The generator behind `light new`. Node-only (`native.tooling`): it reads and writes the file system and spawns the install, so nothing here is compiled by scriptc.

## Shape

| Path | What |
|---|---|
| `command.ts` | `light new`'s argument schema and run; imports `@lightstart/cli` only as a type |
| `kinds.ts` | The kind table and `titleOf` |
| `generate.ts` | Find the checkout, build the manifest and its closure, copy a template, install |
| `templates/<kind>/` | The files a kind writes; every one ends in `.tpl` |
| `test/` | Plain node scripts on `@light/test/assert.ts`, each `// node-only` |

## Rules

- The command is registered in `packages/cli/bin/light.js`'s static table. There is no runtime import of `@lightstart/cli` from this package: `defineCommand` is not used, and `Command` is imported with `import type`.
- `packages/create/package.json` keeps `@lightstart/cli` as a devDependency and a peerDependency, and `packages/cli` depends on `@lightstart/create`.
- A template file is `.tpl` so it never acts as a real `package.json`, `AGENTS.md`, `.gitignore`, `.ts` or `.css` inside this repository.
- The generator writes `package.json` from the kind table; a template never carries one.
- Every `@lightstart/*` dependency named in the generated manifest is linked (`link:`/`file:`) or given a version (`--npm`), and the packages it depends on are added from the same checkout.
- Never write the name of another project's framework in a template.

## Gates

```bash
node packages/native/cli/bin/light-native.js test @lightstart/create
node packages/native/cli/bin/light-native.js typecheck @lightstart/create @lightstart/cli
node packages/native/cli/bin/light-native.js check --all
npx eslint packages/create packages/cli
```
