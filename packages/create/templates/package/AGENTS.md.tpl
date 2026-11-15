# Working in __TITLE__

A light package: TypeScript with erasable syntax, one module entry, tests under node's runner, and a pack script that gives npm the JavaScript it needs. Light's packages are linked from a checkout, so their READMEs are the reference.

## Scripts

| Command | Does |
|---|---|
| `pnpm test` | `node --test test/*.test.ts`: the tests, printed as node's own report |
| `pnpm typecheck` | `tsc -p tsconfig.json`: the compiler over the sources and tests |
| `pnpm check` | `light check`: light's conventions over the sources |
| `pnpm pack` | `node scripts/pack.js`: stages `dist/` and runs `npm pack` there |

## Where things are

| Path | What |
|---|---|
| `index.ts` | The package's one entry: the function `slugify` and the class `Slugger`, each with JSDoc |
| `test/index.test.ts` | Tests on `node:test` and `node:assert/strict` |
| `scripts/pack.js` | The staging script described below |
| `tsconfig.json` | `strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit` |

A new module is a `.ts` file beside `index.ts`, re-exported from it, with a relative import that keeps the `.ts` extension (`export * from "./slug.ts";`). Add an `exports` entry in `package.json` only when the module is a public subpath; the temporary `"./*": "./*"` entry already resolves one by name.

## How the code is written

The sources keep light's conventions for a package that is not compiled natively:

- TypeScript with erasable syntax only: no `enum`, `namespace` or parameter properties, so node can run the sources after stripping types.
- No `any`. Narrow `unknown` with `typeof`, `instanceof` on module-level classes, or `Array.isArray`.
- A JSDoc module header on every file and JSDoc on every exported symbol. No other comments: the code says what it does.
- Import other modules by their `.ts` path. `verbatimModuleSyntax` means a type-only import is written `import type`.
- The entry exports the package's API. An implementation detail stays out of it.

```ts
/**
 * @file Slugs: `slugify` for one string, `Slugger` for one that is not taken.
 */

/**
 * The slug for `text`.
 *
 * @param text The text to slug.
 * @returns The slug.
 */
export const slugify = (text: string): string => text.toLowerCase().trim().replace(/\s+/g, "-");

/**
 * A slugger that numbers a slug it has already answered.
 */
export class Slugger {
  private seen: Map<string, number>;

  /** Start with no slugs given out. */
  constructor() {
    this.seen = new Map();
  }

  /**
   * A slug for `text`, suffixed when an earlier call took it.
   *
   * @param text The text to slug.
   * @returns A slug this slugger has not answered before.
   */
  slug(text: string): string {
    const base = slugify(text);
    const count = this.seen.get(base) ?? 0;
    this.seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${String(count + 1)}`;
  }
}
```

## Tests

A test is a plain node script on `node:test` and `node:assert/strict`; `node --test` runs every `test/*.test.ts`. Test what the module promises through its exports, and import `../index.ts`, not an internal file.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugify } from "../index.ts";

describe("slugify", () => {
  it("joins words with a hyphen", () => {
    assert.equal(slugify("Hello Light"), "hello-light");
  });
});
```

## The pack script

`scripts/pack.js` stages the package into `dist/` for npm. It copies the `.ts` sources and `README.md`, asks `tsc` for one `.d.ts` per module, strips the types off each source into a `.js` beside it, points relative specifiers at `.js`, and writes a `package.json` whose `exports` name the `.d.ts` and the `.js` of every subpath. Then `npm pack` runs in `dist/`.

`dist/` is generated; never edit it. `package.json` keeps `exports` naming the `.ts` sources for the workspace, plus `version`, `publishConfig.access` and `files` for what npm gets, and drops `private` to publish. When the generator that made this package cannot write those fields, add them by hand:

```json
{
  "version": "0.1.0",
  "publishConfig": { "access": "public" },
  "files": ["**/*.js", "**/*.d.ts"],
  "exports": { ".": "./index.ts", "./*": "./*" }
}
```

## Read more

| Package | README |
|---|---|
| `@lightstart/light` | The engine and the view API |
| `@lightstart/cli` | `light`: commands, hooks, routes, extensions, and the `check` command |
| `@lightstart/light/check` | The rules `light check` runs |
| `packages/server/AGENTS.md` | "Rules the sources keep": the erasable TypeScript and JSDoc conventions in full |
| `packages/router` | A package with one entry, subpath exports, tests and the same pack script |
