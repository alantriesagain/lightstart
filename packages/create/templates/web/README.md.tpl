# __TITLE__

A page on [light](https://lightstart.dev): a `View` with a signal counter and `lc-*` components. The page is served in development by `light serve`, bundled by `light build`, and tested in a browser by `light test`.

## Start

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `light serve --watch` on the first free port from 3000 and reloads the page when a file changes.

| Script | Runs |
|---|---|
| `dev` | `light serve --watch` |
| `build` | `light build` into `.deployed/current` |
| `test` | `light test test/*.test.ts` in headless Chromium |
| `check` | `light check` |

The browser tests need Chromium: `pnpm exec playwright install chromium`.

## Where things are

| Path | What |
|---|---|
| `index.html` | The page: `<app-root>` and `src/main.ts` |
| `src/main.ts` | Registers the `lc-*` components and the app's views |
| `src/views/app-root.ts` | The app: a heading, a card and a button with a signal counter |
| `src/styles.css` | The theme and the components' stylesheets |
| `test/app.test.ts` | The browser test |

## Light

The packages are linked from a light checkout (`link:` with pnpm, `file:` with npm). A project started with `--npm` names published versions instead. `AGENTS.md` has the conventions, and the package READMEs in the checkout are the reference.
