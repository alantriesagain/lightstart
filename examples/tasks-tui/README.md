# Tasks, on a terminal

A terminal app on `@lightstart/app`, started with `light new tui` and grown to show what an app has: lists of tasks kept in JSON Lines files, what the run did kept in memory beside them, three pages a key goes to, a flag, a run mode, and a test that drives it all on a test terminal under node and natively. `scriptc` compiles it to one native binary. [tasks-web](../tasks-web) is the same app in a page.

## Start

A project of its own, as `light new` makes one, its packages linked from this checkout (`link:../../packages/<name>`):

```bash
cd examples/tasks-tui
pnpm install
pnpm dev                       # light run: a dev build, run here
pnpm dev -- --list Work        # open the list Work, made when it is not there yet
pnpm dev -- --data ~/tasks     # keep the files in ~/tasks
./dist/tasks-tui --export      # every task as one JSON line, then exit
```

Type a task and press Enter. Tab moves the focus, Space toggles the focused task, `d` removes it. F1, F2 and F3 go to the tasks, the lists and the activity; on the lists, Enter opens one. Ctrl+C quits.

| Script | Runs |
|---|---|
| `dev` | `light run`: a dev build with scriptc, fast when nothing changed, and run the app; `pnpm dev -- --flag` passes flags to the app |
| `test` | `light test`: the app on light's test terminal, under node and natively, the outputs equal |
| `build` | `light build`: the release binary at `dist/tasks-tui` |
| `check` | `light check`: light's native conventions over the sources |

## What it shows

| | Where |
|---|---|
| The app's choices: the host, a flag (`--list`), two stores | `src/app.ts` |
| Two stores at once: `main` (JSON Lines files under `--data`, the terminal's default kind) for lists and tasks; `activity` (memory) for the run's events, a model naming it with `$adapter` | `src/app.ts`, `src/models/event.ts` |
| Models, one per file, the file's name the model's | `src/models/list.ts`, `task.ts`, `event.ts` |
| Controllers starting in the order their imports give: `activity`, then `lists` (which reads `--list` and says what it made), then `tasks` | `src/controllers/` |
| Routes on a terminal: three pages, `<app-outlet>` in the root view drawing the one the path answers, `navigate` from a key | `src/routes.ts`, `src/views/app-root.ts`, `src/views/lists-page.ts` |
| A run mode: `--export` runs before the host and exits, the terminal never started | `src/modes/export.ts` |
| A test: `openApp` with arguments over memory stores, `mountApp` on a test terminal, keys pushed, the screen and the models read back | `test/app.test.ts` |

## Where things are

| Path | What |
|---|---|
| `src/app.ts` | `defineApp`: the host, the flag, the stores |
| `src/models/` | `list`, `task` (in `main`) and `event` (in `activity`) |
| `src/controllers/` | `activity`, `lists`, `tasks`: the live rows and the writes |
| `src/routes.ts` | `/`, `/lists`, `/activity` to their pages |
| `src/views/` | `app-root` (the header, the keys, `<app-outlet>`), the three pages, `task-row` |
| `src/modes/export.ts` | `--export` |
| `.light/` | Generated wiring and the baked class table: never edit, never commit |
| `test/app.test.ts` | The app driven on a test terminal |
