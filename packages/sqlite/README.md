# @lightstart/sqlite

One synchronous SQLite driver in classes, over node's own engine or the
amalgamation linked into a scriptc binary. The dialect, the pragmas and the
transaction rules are the same in both runtimes.

| Import | Runtime |
|---|---|
| `@lightstart/sqlite` | the shared types, `openPragmas` and the statement-cache default |
| `@lightstart/sqlite/node` | `Database.open(path, options)` over `node:sqlite` |
| `@lightstart/sqlite/native` | `Database.open(path, options)` over `native/shim.c` |

scriptc refuses `node:sqlite`, so the two drivers are separate modules; an app
imports only the one its runtime has.

```js
import { Database } from "@lightstart/sqlite/node";

const db = Database.open("app.db");
db.exec("CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT)");
db.prepare("INSERT INTO note (id, title) VALUES (?, ?)").run(["a", "one"]);
console.log(db.prepare("SELECT * FROM note").json()); // [{"id":"a","title":"one"}]
db.close();
```

## A database

- `prepare(sql)` answers a cached `Statement`; past `cacheStatements` (128 by
  default) the least recently used handle is finalized. A statement held past
  its eviction still works: its next call prepares it again and puts it back
  in the cache, so the live handles stay bounded however much SQL a program
  makes.
- `exec(sql)` runs one or more statements with no parameters.
- `transaction(fn)` runs `fn` inside `BEGIN IMMEDIATE`; a call made inside
  another gets its own `SAVEPOINT`, so an inner failure rolls back alone.
- `close()` finalizes the cached statements and closes the file.

`open(path, options)` sets `journal_mode=WAL`, `synchronous=NORMAL`,
`busy_timeout=5000`, `foreign_keys=ON` and `temp_store=MEMORY`. `readOnly`,
`journalMode`, `synchronous`, `foreignKeys`, `busyTimeout`, `cacheSize`,
`mmapSize` and `cacheStatements` override them.

`Database.open(path, { readOnly: true })` makes a reader: it sees the writer's
committed rows and refuses a write. WAL lets several readers run beside the
one writer, so each worker thread of a native server can open its own reader
while the writer thread keeps the only writable connection.

## A statement

- `all(params)` answers row objects; `get(params)` answers the first or null
  (natively one row built in C, and the statement reset at once, so a read
  leaves no cursor open).
- `run(params)` answers `{ changes, lastId }`: SQLite's count of the rows the
  connection's latest write changed, so read it after a write.
- `json(params)` answers the whole result as one JSON string. The native
  driver builds it in C, keeps it on the statement for a short-buffer recopy,
  and never runs a statement twice.
- `columns` is how many columns a step answers: more than zero for a query or
  a write with `RETURNING`.
- `close()` finalizes the statement.

Both drivers answer the same values from `all`, `get` and `json`: an integer
is a number while it is safe and its decimal text past that, a blob is its
base64 text, and a float is written as JavaScript writes it.

Parameters are positional (`["a", 1]`) or named without the prefix
(`{ id: "a", n: 1 }` binds `:id` and `:n`). A boolean is `1` or `0`, an array
or object is JSON text, `undefined` is null, and a `Uint8Array` is a blob.

## Native

`native/build.js` compiles the vendored SQLite amalgamation (`native/vendor/`)
and `native/shim.c` into `native/out/libsqlite.a`, then writes
`native/ffi.json`. It is the package's prepare step. The shim writes JSON into
a caller buffer and answers its length, or minus the size it needs, because
FFI cannot return strings. The shared suite runs under node over `node.ts` (`test/node.test.ts`) and over
the C shim in `test/native.test.ts`, marked `// native-only` so node never
imitates the native calls. There is no stand-in driver.

## Gates

```bash
node packages/native/cli/bin/light-native.js test @lightstart/sqlite
node packages/native/cli/bin/light-native.js coverage @lightstart/sqlite
node packages/native/cli/bin/light-native.js typecheck @lightstart/sqlite
```
