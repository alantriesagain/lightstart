# Working on @lightstart/admin

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineAdmin` and `AdminConfig`, and the page API re-exported (`files`, `history`, `dialogs`, the slots and their item types) |
| `extension.ts` | The app extension: `name: "admin"` and the `/admin` route in `admin-shell` |
| `slots.ts` | `adminSections` (`admin.sections`), `adminCommands` (`admin.commands`) and `adminHeader` (`admin.header`), their `AdminSection`/`AdminCommand`/`AdminHeaderItem` shapes |
| `paths.ts` | `pathProblem`, `assertPath` and `withinFolder`: the path rules the page and the server share |
| `config.ts` | `toolsProblem`, `validateTools` and `toolsOf`: the plain-data rules for per-tool settings |
| `files.ts` | `files` (`read`, `readBlob`, `write`, `delete`, `list`, `exists`, `changed`), `FilesBackend`, `DevFilesBackend`, `configureFiles` and `loadAdminSession` |
| `history.ts` | `history.snapshot`/`undo`/`redo`, `canUndo`/`canRedo` and `labels` |
| `state.ts` | `adminConfig` (`AdminPageConfig`), `toolConfig`, `adminTitle`, the `notifications` signal and the open flag |
| `dialogs.ts` | `dialogs.message`/`confirm`/`prompt`/`notify`, the `activeDialog` signal and `settle` |
| `views/admin-shell.ts`, `views/admin-home.ts` | The shell and landing views; their tags come from `tags.json` |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `cli/extend/serve.ts` | Mounts the guarded dev file API on `light serve` |
| `node/config.ts` | `adminPathOf`, `readAdmin`, `validateFolders`, `adminTitleOf`, `adminFoldersOf` and `adminToolsOf` |
| `node/serve.ts` | `createAdminApp`, `resolveAdminPath`, `newAdminToken`, `ADMIN_BODY_LIMIT` and the guard |
| `node/index.ts` | The `@lightstart/admin/node` entry |
| `test/` | Plain scripts on `@lightstart/test/assert.ts`; `test/browser/` holds the Chromium test, spawned by `test/admin.browser.test.ts` |

## Rules the sources keep

- The package is dev-only: `package.json`'s `light` says `"extension": "./extension.ts", "devOnly": true, "tags": "tags.json"`, so a release build leaves it out.
- `src/admin.ts` or `src/admin.js`, exactly one (both is an error naming both), default-exports `defineAdmin({ title?, folders, tools? })`; a project with neither allows nothing. `tools` is a record of records of plain JSON data, checked by `config.ts` in the page and in `node/config.ts`.
- Every folder and every path follows `paths.ts`: relative, forward slashes, no `..`, no leading slash, no control characters, no dotfile, no `.git`, `node_modules`, `.light` or `.deployed`.
- The server resolves every path inside an allowed folder after symlinks, and refuses a non-loopback host, a wrong token on a file or listing request, a cross-origin session, and a body over 200 MiB. It never sends `Access-Control-Allow-Origin`. Writes are a temp file and a rename.
- The page validates paths before a request and keeps the token in memory only. `changed` bumps after a write, a delete, and a dev-server file change inside an allowed folder.
- `history` records the paths before and after `fn` and restores exactly those contents; an outside change does not stop a recorded step from restoring.
- The shell draws `adminSections.items`, reads the current section from `currentRoute`, and draws the dialog and toast outlets. It draws each `adminHeader.items` entry as the custom element its `tag` names, after the title and in order. A tool's routes use `layout: "admin-shell"`.
- The tag table declares each view's `uses`; the admin writes `lc-*` tags and no one-off control where a component fits.
- Comments are a JSDoc module header and JSDoc on exported symbols, nothing else.
- TypeScript with erasable syntax only; no `any`; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineAdmin`, `AdminConfig` and its `title`/`folders`/`tools` | a project's `src/admin.ts` (or `.js`) |
| The `admin` extension, `tags.json`, `<admin-shell>` and `<admin-home>` | the app generation and the web host |
| `adminSections`, `adminCommands`, `adminHeader`, `AdminSection`, `AdminCommand` and `AdminHeaderItem` | a tool filling them |
| `files`, `FilesBackend`, `FileEntry`, `changed` and `configureFiles` | a tool, and a later GitHub backend |
| `history` and its `snapshot`/`undo`/`redo` | a tool with edits |
| `dialogs`, `activeDialog`, `notify` and `notifications` | a tool asking the reader, and the shell drawing it |
| `adminConfig`, `AdminPageConfig` and `toolConfig` | a tool reading its settings after the session loads |
| `GET /__admin/session` (`{ token, folders, title, tools }`), `GET|PUT|DELETE /__admin/files`, `GET /__admin/list` and `x-light-admin-token` | the default backend, and a test of the API |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/admin @lightstart/app
light test @lightstart/admin
light test @lightstart/app
npx eslint packages/admin
```
