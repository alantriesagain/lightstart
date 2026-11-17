# __TITLE__

A light package: one module in TypeScript, tested under `node --test`, checked by `light check`, and packed for npm with JavaScript and a `.d.ts` beside each module. This one exports `slugify`, which turns text into a URL-safe slug, and `Slugger`, which numbers the slugs it gives out so no two are alike.

## Install

```bash
pnpm install
```

## Use

```js
import { Slugger, slugify } from "__NAME__";

slugify("Hello, Light!"); // "hello-light"

const slugger = new Slugger();
slugger.slug("Hello World"); // "hello-world"
slugger.slug("Hello, World!"); // "hello-world-2"
```

| Export | What |
|---|---|
| `slugify(text)` | The slug for one string: accents folded, lowercase, runs of other characters joined by one hyphen, ends trimmed |
| `Slugger` | A slugger that remembers its answers; `new Slugger().slug(text)` adds `-2`, `-3`, … to a slug already taken |

## Scripts

| Script | Runs |
|---|---|
| `test` | `node --test test/*.test.ts`, node's own runner over the tests |
| `typecheck` | `tsc -p tsconfig.json`, the TypeScript compiler over the sources |
| `check` | `light check`, light's conventions over the sources |
| `lint` | `light lint`, eslint with the project's config |
| `verify` | `light verify`, check, lint, typecheck and test in order |
| `pack` | `node scripts/pack.js`, stages `dist/` and runs `npm pack` there |

Run `pnpm verify` before committing.

## Where things are

| Path | What |
|---|---|
| `index.ts` | The module: `slugify` and `Slugger`, each with its JSDoc |
| `test/index.test.ts` | The tests, on `node:test` and `node:assert/strict` |
| `scripts/pack.js` | What npm gets: JavaScript, a `.d.ts` per module, and a package.json whose exports name both |
| `tsconfig.json` | The compiler settings the sources keep |

## Light

The packages are linked from a light checkout (`link:` with pnpm, `file:` with npm). A project started with `--npm` names published versions instead. `AGENTS.md` has the conventions, and the package READMEs in the checkout are the reference.
