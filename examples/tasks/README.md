# Tasks: a terminal app on light

A task list on the terminal, built from light's three parts and nothing else: a model (`models/tasks.js`, `defineModel` over `T`), a controller (`controllers/board.js`, `defineController` with its rows bound to a live query of the model), and views (`views/task-app.js`, a `View` from `@bootstrapp/light/native` rendering into the terminal host). The rows live in a JSON Lines file through light's JSONL adapter, one line per write, so the file is readable and appendable by any other program.

```
node examples/tasks/main.js                 # rows in ./tasks.jsonl
node examples/tasks/main.js --data ~/tasks  # rows in ~/tasks/tasks.jsonl
node examples/tasks/tasks.test.js           # drives the app on a test terminal
```

It compiles to one native binary with scriptc (the fork's `light-integration`, named by `SCRIPTC`; see `native/README.md`), with no JavaScript engine inside: the model, the controller, the views, the JSONL files and the terminal host. The test builds the same way and prints what it prints under node.

```
$SCRIPTC build examples/tasks/main.js -o tasks --strip     # about 7 MB
./tasks --data ~/tasks
$SCRIPTC build examples/tasks/tasks.test.js -o tasks-test && ./tasks-test
```

The editor has the focus at start: type a task and press Enter to add it. Tab moves the focus between the tasks and the editor, and the arrows move it among the tasks. On a focused task, Space (or a click) toggles it and `d` deletes it; outside the editor `f` cycles the filter (all, open, done) and `c` clears the done tasks. Ctrl+C quits.

| File | What it holds |
|---|---|
| `models/tasks.js` | The model: a title, whether it is done, when it was added |
| `controllers/board.js` | The filter, the rows the filter selects (a `sync:` binding to the model, rebuilt when the filter changes), the open and done counts it recounts on every change, and the writes |
| `views/task-app.js` | The screen: the list keyed by task, the editor, the footer, and `appKey`, the keys that work wherever the focus is outside the editor |
| `lib/file-io.js` | The JSONL adapter's files through `node:fs` |
| `main.js` | The entry: the adapter, the store, the request every model call goes through, the terminal |
| `tasks.test.js` | The app on `native/test-terminal.ts`, with its files in memory |

The store runs in the same process as the views, so `configureModel({ request: storeRequest(store) })` is the whole transport. The same model and controller would run in a browser page over IndexedDB by changing the adapter and the views.
