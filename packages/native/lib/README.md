# @light/lib

What the core's modules share, importing nothing of light and nothing of the workspace:

| Module | Holds |
|---|---|
| `json.ts` | `isRecord`, `recordOf`, `text`, `num`, `errorMessage`, and the JSON-as-text writers `objectText`, `listText` (natively an object filled by computed keys slows every call) |
| `fs.ts` | `readTextOr`, `writeAtomic` (beside the file, then renamed over), `stampOf` (size and floored mtime) |
| `paths.ts` | `SKIP_DIRS`, `joinRel`, `addParentDirs`, `expandHome` |
| `process.ts` | `spawnCapped(command, args, SpawnOptions)`: a child run to its end or its time, output capped, never rejecting (`ProcessRun`) |
| `timing.ts` | `Closer` (a watcher's close held in a class), `Latest` (the latest call wins) |
| `log.ts` | `nameLog` (the app's name, which the log's own warnings start with), `openLog`, `openLogIn` (a file of the run's own in a folder, the oldest pruned), `log`, `logPath` (diagnostics never touch stdout while a screen is up; a log past its cap stops), `trail` (what ran last: keys, plugin calls, a frame's phases, for a crash to name, since natively an error has no stack), `argValue`, `hasArg` |
| `ndjson.ts` | `LineSplitter`, chunked UTF-8 into lines |

Import a module by its path (`@light/lib/json.ts`); `@light/lib` re-exports them all.
