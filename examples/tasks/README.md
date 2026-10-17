# Tasks: a terminal app on light

Boards of tasks on the terminal, built from light's three parts and nothing else: two models (`models/tasks.js` and `models/boards.js`, `defineModel` over `T`), a controller (`controllers/board.js`, `defineController` with its rows and boards bound to live queries of the models), and views (`views/`, `View`s from `@bootstrapp/light/native` rendering into the terminal host, two of them elements a template names by tag). The rows live in JSON Lines files through light's JSONL adapter, one line per write, so the files are readable and appendable by any other program.

```
node examples/tasks/main.js                 # rows in ./tasks.jsonl and ./boards.jsonl
node examples/tasks/main.js --data ~/tasks  # rows in ~/tasks/
node examples/tasks/main.js --scheme light  # the theme's light side; dark by default
node examples/tasks/tasks.test.js           # drives the app on a test terminal
```

It compiles to one native binary with scriptc (the fork's `light-integration`, named by `SCRIPTC`; see `native/README.md`), with no JavaScript engine inside: the model, the controller, the views, the JSONL files and the terminal host. The test builds the same way and prints what it prints under node.

```
$SCRIPTC build examples/tasks/main.js -o tasks --strip     # about 9.5 MB, 2.5 of them the classes engine
./tasks --data ~/tasks
$SCRIPTC build examples/tasks/tasks.test.js -o tasks-test && ./tasks-test
```

Every board is a column; the focused one, its title bold in the theme's primary color, is where a typed task goes. The screen is styled by the theme's utility classes on the terminal (`flex-1`, `border`, `overflow-y-auto`, `text-muted`, `line-through`, `font-bold`, `text-primary`, `bg-surface`, and `focus:font-bold` on a row, `focus-within:bg-surface` on a board, which follow the focus), the same names a page uses, resolved through the default preset's dark side unless `--scheme light`. The editor has the focus at start: type a task and press Enter to add it. A line starting with `/` is a command: `/board Name` adds a board after the focused one, `/rename Name` renames it, `/delete` removes it while it is empty. Tab moves the focus between the tasks and the editor, Esc brings it back to the editor, ↑ and ↓ move it along a board's tasks and ← and → across boards. On a focused task, Space (or a click) toggles it, `d` deletes it, Shift+← and Shift+→ move it to the neighbour board; `[` and `]` move the focused board left or right. Outside the editor `f` cycles the filter (all, open, done) and `c` clears the done tasks. Ctrl+C quits. A `tasks.jsonl` from before boards opens as it is: its tasks join the first board, which the app makes when there is none.

| Key | Does |
|---|---|
| typing + Enter | adds a task to the focused board |
| `/board Name`, `/rename Name`, `/delete` | adds a board after the focused one, renames it, removes it while empty |
| Tab, Esc | moves the focus along the tasks and the editor; back to the editor |
| ↑ ↓, ← → | focus along a board's tasks; across boards |
| Space, `d` | toggles the focused task; deletes it |
| Shift+← Shift+→ | move the focused task to the neighbour board |
| `[` `]` | move the focused board left or right |
| `f`, `c`, Ctrl+C | cycles the filter; clears the done tasks; quits |

| File | What it holds |
|---|---|
| `models/tasks.js` | The tasks: a title, whether it is done, when it was added, the board it belongs to |
| `models/boards.js` | The boards: a title and a position |
| `models/types.ts` | The `Task` and `Board` row types the TypeScript views read |
| `controllers/board.js` | The boards in order and the focused one, the filter, the rows the filter selects (`sync:` bindings to the models, rebuilt when the filter changes), the open and done counts it recounts on every change, the writes, and the editor's commands; on start it makes a first board when there is none and gives tasks from before boards to the first one |
| `views/task-row.ts` | `<task-row .task=${task}>`: one task as a focusable line, muted and struck through by its classes when done and bold while focused, asking for its toggle, removal or move with an event |
| `views/tasks-board.ts` | `<tasks-board .board=${board} .tasks=${tasks}>`: one board as a bordered column, tinted while the focus is inside it, its title a line of its own, its rows in a scroll box and a `<slot>` for the footer line the app puts under them |
| `views/task-app.ts` | The screen: the boards side by side, each a `<tasks-board>` keyed by board with its footer slotted in, the editor, the footer, and `appKey`, the keys that work wherever the focus is outside the editor |
| `lib/file-io.ts` | The JSONL adapter's files through `node:fs` |
| `main.js` | The entry: the adapter, the store, the request every model call goes through, the theme's classes on the terminal, the terminal |
| `tasks.test.js` | The app on `native/test-terminal.ts`, with its files in memory, starting from a task from before boards; three classes read off the painted cells, the focus states among them, and no class the terminal ignored |

The views and the file IO are TypeScript, as the code scriptc compiles is; the model, the controller, the entry and the test are JavaScript with JSDoc, because `defineModel` and `defineController` do not compile from TypeScript yet (their return types and the `this` of a definition's methods have no native shape, and `T`'s descriptors do not lower), while JSDoc-typed JavaScript falls back to checked-dynamic values that do. A TypeScript view may still read the controller it imports.

The store runs in the same process as the views, so `configureModel({ request: storeRequest(store) })` is the whole transport. The same model and controller would run in a browser page over IndexedDB by changing the adapter and the views.
