# __TITLE__

A web app on [light](https://lightstart.dev): a note model, a notes controller, and views with `lc-*` components. The folders are the app; light writes the wiring into `.light/`, and the host opens the store, starts the controllers, builds the routes and mounts the root view.

## Start

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `light serve --watch` on the first free port from 3000 and reloads when a file changes.

| Script | Runs |
|---|---|
| `dev` | `light serve --watch` |
| `build` | `light build` into `.deployed/current` |
| `test` | `light test test/*.test.*` in headless Chromium |
| `check` | `light check` |
| `lint` | `light lint`: eslint with the project's config |
| `typecheck` | `light typecheck`: `tsc --noEmit` over the sources, the tests and `.light/` |
| `verify` | `light verify`: check, lint, typecheck and test in order |

The browser tests need Chromium: `pnpm exec playwright install chromium`. Run `pnpm verify` before committing.

## Where things are

| Path | What |
|---|---|
| `src/app.__EXT__` | The app's name and host |
| `src/models/note.__EXT__` | The note model |
| `src/controllers/notes.__EXT__` | The live notes and the write that adds one |
| `src/views/app-root.__EXT__` | The root view: the heading, the notes, the field and the button |
| `src/views/app-home.__EXT__`, `src/views/app-about.__EXT__` | The route views |
| `src/routes.__EXT__` | `/` and `/about` to their views |
| `src/styles.css` | The generated components' stylesheet, and the page's own rules |
| `.light/` | Generated wiring: never edit, never commit |
| `test/app.test.__EXT__` | The browser test |

## Light

The packages are linked from a light checkout (`link:` with pnpm, `file:` with npm). A project started with `--npm` names published versions instead. [AGENTS.md](AGENTS.md) has the conventions; `@lightstart/app`'s README and the other package READMEs in the checkout are the reference.
