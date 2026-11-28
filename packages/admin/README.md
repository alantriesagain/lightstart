# @lightstart/admin

A project admin as an app extension. `@lightstart/admin` contributes `/admin`
in its own shell, exports the slots a tool fills, and gives tools a page API for
the project's files, an undo stack, and dialogs. It is dev-only: the package's
extension carries `light.devOnly`, so `light build` leaves it out of a release
while `light serve` and `light test` run it.

```js
// src/admin.js
import { defineAdmin } from "@lightstart/admin";

export default defineAdmin({
  title: "Site admin",
  folders: ["social"],
  tools: { social: { feed: "home" } },
});
```

Both `src/admin.ts` and `src/admin.js` is an error naming both, as an app has one
`src/app` module. A project with no `src/admin`, or with `folders: []`, lets the
admin read and write nothing.

## defineAdmin

| Field | What |
|---|---|
| `title` | The shell's title; `"Admin"` when absent |
| `folders` | Project-relative folders the admin may read and write |
| `tools` | Per-tool settings, a record of plain-data records; `{}` when absent |

A folder is relative, with forward slashes, no `..`, no leading slash, no
control characters, and no segment that is a dotfile or `.git`, `node_modules`,
`.light` or `.deployed`. `defineAdmin` checks them when the module loads, and the
server checks every path again.

`tools` names each tool's settings. Every tool is a record of settings, and every
setting has to survive `JSON.stringify` unchanged: strings, finite numbers,
booleans, nulls, arrays and plain objects. A function, symbol, `undefined`, a
non-finite number, or a class instance such as a `Date` or a `Map` is refused when
the config loads, naming the tool and setting.

## The extension and slots

The package's `extension.ts` adds the route:

```js
{ "/admin": { name: "admin-home", view: "admin-home", layout: "admin-shell" } }
```

A tool is another extension. It adds routes under `/admin/...` with the same
`layout: "admin-shell"`, and fills the three slots this package exports:

```ts
import { defineExtension } from "@lightstart/app";
import { adminCommands, adminHeader, adminSections } from "@lightstart/admin";

export default defineExtension({
  name: "social",
  fills: [
    adminSections.entry({ id: "social", title: "Social", icon: "calendar", path: "/admin/social", order: 10 }),
    adminCommands.entry({ id: "social-new", title: "New post", icon: "plus", run: () => openComposer() }),
    adminHeader.entry({ id: "social-status", tag: "social-status-chip" }),
  ],
  routes: { "/admin/social": { name: "social", view: "social-page", layout: "admin-shell" } },
});
```

`adminSections` holds `{ id, title, icon, path, order? }`: the sidebar entries.
`adminCommands` holds `{ id, title, icon?, run(): unknown, order? }`: the command
palette's commands. `adminHeader` holds `{ id, tag, order? }`: the shell draws the
custom element named by `tag` after the title. The shell marks the current section
from `currentRoute`, opens the palette with Ctrl/Cmd+K, and runs the chosen
command.

## files

`files` reads and writes project-relative paths inside the allowed folders:

```ts
import { files } from "@lightstart/admin";

const source = await files.read("social/post.md");     // string | null
const blob = await files.readBlob("social/cover.png"); // Blob | null
await files.write("social/post.md", source ?? "");
await files.delete("social/draft.md");
const rows = await files.list("social"); // FileEntry[], [] when missing
if (await files.exists("social/post.md")) { /* ... */ }
files.changed.value; // bumps after every write or delete
```

`FileEntry` is `{ path, name, kind: "file" | "dir", size, modified }`, sorted by
name. Each method validates its path before any request. The backend is
pluggable with `configureFiles(backend: FilesBackend)`; the default is the dev
file API below. A later GitHub backend implements the same interface.

`changed` is a light signal. It bumps after a write or delete through `files`,
and when the dev server's reload websocket reports a file change inside an
allowed folder; another site cannot fake the message because the API's token
stays in memory and is never in storage.

## history

`history` is an undo stack over `files`:

```ts
import { history } from "@lightstart/admin";

await history.snapshot(["social/post.md"], "edit post", async () => {
  await files.write("social/post.md", next);
});

await history.undo();
await history.redo();
history.canUndo.value; // signal
history.canRedo.value; // signal
history.labels();      // ["edit post"]
```

A snapshot records each path before and after `fn` and pushes one step, so undo
and redo write the recorded contents back. A step whose files changed outside
the stack since it was taken still restores exactly what it recorded.

## dialogs

```ts
import { dialogs } from "@lightstart/admin";

dialogs.message("Saved", { kind: "info" });        // a toast
const ok = await dialogs.confirm("Delete it?", { danger: true });
const name = await dialogs.prompt("Name", { value: "Untitled" });
dialogs.notify({ title: "Render done", kind: "success" });
```

`confirm` and `prompt` are drawn by the admin shell; `message` uses
`@lightstart/components`' toast queue; `notify` adds to the header's
notification list.

## The dev file API

`light serve` mounts the API under `/__admin` through the package's
`cli/extend/serve.ts`:

| Request | Answer |
|---|---|
| `GET /__admin/session` | `{ token, folders, title, tools }` |
| `GET /__admin/files?path=` | The file with a guessed content type, or 404 |
| `PUT /__admin/files?path=` | Writes the body as bytes, making the parent folders |
| `DELETE /__admin/files?path=` | Deletes the file |
| `GET /__admin/list?path=` | The entries, or `[]` when the folder is missing |

The security is part of the API:

- The `Host` header's hostname must be `localhost`, `127.0.0.1` or `[::1]`, or
  the bind host a caller passes as `serverHost`; anything else is 403. This
  defeats DNS rebinding.
- `GET` of a file or listing, and every `PUT` or `DELETE`, needs
  `x-light-admin-token` equal to the session's token. The token is 32 random
  bytes per server start, compared in constant time. The session call itself
  needs no token, but it rejects a cross-origin `Origin` and any
  `Sec-Fetch-Site` other than `same-origin` (or absent). The API never sends
  `Access-Control-Allow-Origin`.
- Every path is resolved against the project and must stay inside one allowed
  folder, including through symlinks (`realpath` of the nearest existing
  parent). `..`, absolute paths, and writes into `.git`, `node_modules`,
  `.light` and `.deployed` are refused.
- A body over 200 MiB (`ADMIN_BODY_LIMIT`) is 413.
- Writes are atomic: a temp file in the same folder, then a rename.

The page reads `/__admin/session` once and keeps the token in memory.

## The loaded config

The session's title, folders and per-tool settings are page state:

```ts
import { adminConfig, toolConfig } from "@lightstart/admin";

adminConfig.value;        // { title, folders, tools } | null until the session loads
toolConfig("social");     // that tool's settings, or {} before the load or when it has none
```

`adminConfig` is null until `/__admin/session` answers. `toolConfig(name)` reads
one tool's record from it, so a tool reads its own settings after the shell has
loaded the session.

## Writing a tool

A tool is an extension with a name, its `fills` of `adminSections` and
`adminCommands`, and its routes under `/admin/...` with `layout: "admin-shell"`.
Its views are ordinary `@lightstart/light` views registered with their tags (or
a package's own `tags.json`). Its code reads and writes the project through
`files`, wraps edits in `history.snapshot`, asks the reader through `dialogs`,
and reads its own settings with `toolConfig(name)`. It may put a small custom
element in the header through `adminHeader`. The shell, sidebar, palette,
notifications, dialogs and toasts are already there.

## Later

- A GitHub backend implementing `FilesBackend`, so `files` writes commits
  through GitHub's API instead of the dev file API.
- A deployed admin with GitHub sign-in, reading the same project paths.
- The admin's own package test fixture as a full example project.
