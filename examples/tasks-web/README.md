# Tasks, in a page

A web app on `@lightstart/app`, started with `light new web` and grown to show what an app has: lists of tasks kept in IndexedDB, what the page did kept in memory beside them, three routes drawn by `<app-outlet>`, an argument read from the URL, and a test in headless Chromium. [tasks-tui](../tasks-tui) is the same app on a terminal: its models and controllers are the same files, only the views differ.

## Start

A project of its own, as `light new` makes one, its packages linked from this checkout (`link:../../packages/<name>`):

```bash
cd examples/tasks-web
pnpm install
pnpm dev                       # light serve --watch, then open the page
```

`?list=Work` in the URL opens the list Work, made when it is not there yet. Add a task with the form; its checkbox toggles it. The nav goes to the tasks, the lists and the activity; on the lists, a list's button opens it.

| Script | Runs |
|---|---|
| `dev` | `light serve --watch`: the page, rebuilt as files change |
| `test` | `light test test/*.test.ts`: the app in headless Chromium |
| `build` | `light build`: a kept build in `.deployed/` |
| `check` | `light check`: light's conventions over the sources |

## What it shows

| | Where |
|---|---|
| The app's choices: the host, an argument (`list`, from the URL query), two stores | `src/app.ts` |
| Two stores at once: `main` (IndexedDB, the web host's default kind) for lists and tasks; `activity` (memory) for the page's events, a model naming it with `$adapter` | `src/app.ts`, `src/models/event.ts` |
| Models, one per file, the file's name the model's | `src/models/list.ts`, `task.ts`, `event.ts` |
| Controllers starting in the order their imports give: `activity`, then `lists` (which reads `list` and says what it made), then `tasks`; the same files as the terminal app's | `src/controllers/` |
| Routes: three pages, `<app-outlet>` in the root view drawing the one the path answers, links and `navigate` going to them | `src/routes.ts`, `src/views/app-root.ts`, `src/views/lists-page.ts` |
| Light's components (`lc-button`, `lc-card`, `lc-text`), each registered by the view that writes it, its stylesheet imported in `src/styles.css` | `src/views/`, `src/styles.css` |
| A test: the generated entry booted in the page, the form filled, `navigate` between routes, the text read back | `test/app.test.ts` |

## Where things are

| Path | What |
|---|---|
| `src/app.ts` | `defineApp`: the host, the argument, the stores |
| `src/models/` | `list`, `task` (in `main`) and `event` (in `activity`) |
| `src/controllers/` | `activity`, `lists`, `tasks`: the live rows and the writes |
| `src/routes.ts` | `/`, `/lists`, `/activity` to their pages |
| `src/views/` | `app-root` (the header, the nav, `<app-outlet>`) and the three pages |
| `src/styles.css` | The theme and the components' stylesheets, and the page's own rules |
| `index.html` | The page: `<app-root>` and `.light/main.ts` |
| `.light/` | Generated wiring: never edit, never commit |
| `test/app.test.ts` | The app driven in the browser |
