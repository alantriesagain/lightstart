# @lightstart/moderation

What people send waits in one queue until somebody reviews it, and the person
who sent it sees it meanwhile as if it were already there. A model declares
`$moderated`; from then on a client write to it is a submission, the row waits
on the sender's own device as a pending row of that model, the admin approves
or rejects it, and only an approved one is published. Nobody is told they were
rejected: their pending row stays with them.

This is the core of the package: the server contribution, the page decorator
and the photo kind. The review queue under `/admin` (`extensions/queue/`) comes
later.

## A moderated model

```js
// src/app.js
export default defineApp({ name: "meetup", host: "web", stores: { server: { adapter: "api" } } });

// src/models/place.js
export default defineModel("place", {
  name: T.string(),
  slug: T.string(),
  provenance: T.array(),
  $store: "server",
  $shadow: "indexeddb",
  $moderated: { edit: true },
  $permissions: { read: "public", create: "none", write: "none", delete: "none" },
});
```

Two layers hold the model. The base adapter (the `api` store) holds the
published rows, in the model's server table; a client never writes it. The
shadow, an IndexedDB object store with the model's own name and indexes on the
device (`$shadow`), holds the signed-in person's pending rows in the model's
shape plus one marker:

```js
pending: { id, op: "add" | "edit", by, provenance }
```

`id` is the submission, `by` the sender's user id, `provenance` the hash a
published record will carry for it. `pendingOf(row)` reads the marker, null on
a published row; `Pending<R>` is the row type a view holds.

- **Writing.** `place.add(row)` runs the store's pipeline (hooks, the slug,
  defaults, validation), submits `{ kind: "place", payload: row }` and keeps the
  row in the shadow. `edit(id, patch)` on a published row needs
  `$moderated: { edit: true }`: it submits `place.edit` with the patch as
  payload (`targetType` the model, `targetSlug` the id) and keeps the merged
  row in the shadow. An edit of a pending add stays on the device. `remove(id)`
  drops a pending row from the shadow and refuses a published one. `single`
  keeps one pending add per person.
- **Reading.** `query`, `get`, `count` and `exists` answer the viewer's pending
  rows first, then the base, with the total of both and the window re-offset;
  a pending edit stands in for its published row. `where.pending` picks one
  layer: `true` the shadow alone, `false` the base alone. `fields` project both
  layers, keeping the marker.
- **Who sees what.** The viewer is `configureModeration`'s `viewer`, the
  signed-in account of `@lightstart/auth`'s token by default. Signed out, or
  signed in as somebody else, the shadow answers nothing.
- **Healing.** Publishing writes `provenance: [provenanceOf(submission id)]`
  on the record. A read whose base rows carry a pending row's provenance drops
  that row from the shadow and, once the read has answered, emits `published`
  (`{ model, id, key, row }`). A moderated model lists `provenance` in its
  schema so the published row can carry it; a `where.pending` read heals by
  slug. A rejected submission produces no record, so its row stays with its
  sender.
- **Bypassing.** A write with `{ direct: true }` or a seed (`importing`)
  passes through to the base. The server is the real gate: `$permissions` is
  `none` for a client, and the policy on the server decides.

## The server

Declaring the package is the whole setup. Its `package.json` names a server
contribution (`light.server`), so every app on `@lightstart/api` that depends
on it gets:

- the `submission`, `moderation_avatars` and visitor `visits` tables, which
  `light db:migrate` creates;
- the endpoints below;
- the `avatar` kind.

| Route | Who | What |
|---|---|---|
| `POST /api/moderation/submit` | a signed-in person | runs the kind's policy and answers `{ id }` |
| `GET /api/moderation/pending?status&kind` | admin | the queue, `pending` by default |
| `GET /api/moderation/mine?status` | the sender | their own submissions, `pending` by default |
| `PATCH /api/moderation/submissions/:id` | admin | a review move, and the payload a review corrects |
| `DELETE /api/moderation/submissions/:id` | admin | takes a published one down first |
| `GET\|HEAD /api/files/<key>` | anyone | a published photo, from the site's own origin |

`submission` is `$permissions: none`, so the CRUD routes never expose the
queue. A submission is written by the policy, not by a caller: the server
stamps the id, the status, the sender, the hashed address and the browser,
whatever the request says.

### Kinds

A project that needs kinds of its own builds its endpoints with
`moderationEndpoints({ kinds, models })` and a `submissionPolicy`. The default
accepts `avatar` and each server model that declares `$moderated` (its payload
is the row); `<model>.edit` only when it declares `$moderated: { edit: true }`.
A table that doesn't declare it, such as `users`, `auth_codes` or the app's
other server models, is never a kind: a submission can't be published into it or
taken down from it, whatever the sender puts in `kind` or `targetType`.

Every key is optional.

| key | what it does |
|---|---|
| `accept({ payload, user, request, db, env })` | checks what was sent and answers `{ payload }` to keep, or `{ error, status }` to refuse. It may be async, and `db` is the binding |
| `single` | one waiting submission per person: sending another replaces the older pending or rejected one and drops its payload |
| `perHour` | how many one person may send in an hour |
| `maxPayload` | the most characters its payload may take as JSON, 32000 by default |
| `publish({ submission, db, env, request })` | goes public at approval and answers `{ url, objectKey, payload, targetSlug }`; a `Response` refuses the approval |
| `unpublish(ctx)` | takes a published one down when it is removed, or replaced by a newer one of a `single` kind |
| `terminal` | ends at its review: approval settles it, nothing is published |

A kind without `publish` that names a `$moderated` model publishes into that
model's table; the table comes from the kind alone, never from the sender's
`targetType`. A kind without either waits, approved.

### Publishing, and what changed

The source published a `$store: "file"` model through the project's own
`pullApprovedSubmissions` script. In light a moderated model is a server model
(`$store` on an `api` store), so approval publishes the payload straight into
the model's table. The row is encoded as `crudApp` encodes it (objects and
arrays as JSON text, booleans as 1 or 0) and carries `provenance`, which is
what heals the sender's pending row. A published row's id is kept on the
submission's `targetSlug`, so taking it down can find it. There is no drain
script and no file-backed content step.

A kind's own `publish` runs first, exactly as before (the avatar kind uses it).

### Photos

`avatar` is a kind this package ships: a person's profile photo.

- **Sending.** The payload is `{ image }`, a data URL `readImageDataUrl`
  accepts: webp, jpeg or png whose bytes agree with the type, at most 150KB,
  128 to 1024px, square within 2%, one frame. One waits per person, five an
  hour, never from the dev admin.
- **Approving.** The file goes to the project's `STORAGE` binding at
  `avatars/<submission id>.<ext>`, an address that names no account.
  `@lightstart/auth`'s `users` table carries no photo column, so the address is
  kept in `moderation_avatars`, keyed by the account id. No bucket answers 503
  and a failed write 502, and the row stays pending either way.
- **Serving.** `GET|HEAD /api/files/*` answers from the site's own origin. Only
  a key a publish could write is looked up. The type comes from the key, and
  the answer carries `nosniff`, a sandboxing content policy and a year of
  caching.
- **Removing.** Deleting a published row deletes the file and clears the photo
  while it is still this one.
- **Provider pictures.** `queueProviderAvatar` copies a sign-in provider's
  picture once into a pending photo, for the auth core's
  `onProviderPicture`-style hook.

In the browser, `photoFor(person, own)` is the address to draw a person from;
`ownPhotoOf(photos)` is the newest photo you sent from this device, and
`dataUrlOf(blob)` writes a cropped blob as the data URL a photo is sent in.
The device-local `pendingPhoto` controller of the source is not in this part.

### Deleting an account

`forgetUser(db, userId, storage?)` deletes the files the account's submissions
stored, then its submission rows and its published photo. A failure throws
before any row is gone, so the account stays in place and the next attempt
finds the same files.

Wire it from auth's `onUserDeleted` hook. The contributed auth endpoints take
no hooks, so an app that deletes accounts builds its own:

```js
import { authEndpoints } from "@lightstart/auth/server";
import { forgetUser } from "@lightstart/moderation";

const endpoints = authEndpoints({
  mailer,
  hooks: { onUserDeleted: (id, db) => forgetUser(db, id, storage) },
});
```

## The page

```js
import { configureModeration, pendingOf } from "@lightstart/moderation/page";

configureModeration({ viewer: () => auth.user?.id ?? null });

const marker = pendingOf(row); // null on a published row
```

Importing `@lightstart/moderation/page` registers the `$moderated` adapter
decorator. `configureModeration` sets the viewer, the submitter (the default
posts to `/api/moderation/submit` with the session token) and the provenance
function. `submitToServer(kind, payload)` is the default submitter;
`viewerFromToken()` reads the account id from the auth token.

## Files

| File | Runtime | Role |
|---|---|---|
| `index.ts` | every | statuses, review moves, the submission id, payload helpers, `pendingOf`, `provenanceOf`, the `published` event |
| `types.ts` | every | the shared types, the `$moderated` directive, the storage shape |
| `server/models.ts` | server | `submission`, `moderation_avatars` |
| `server/policy.ts` | server | `submissionPolicy`: the send, review and remove phases |
| `server/contribute.ts` | server | the contribution `light.server` names: models and endpoints |
| `server/image.ts` | server | `readImageDataUrl`, the one gate between a request body and a stored photo |
| `server/avatar.ts` | server | the `avatar` kind and `queueProviderAvatar` |
| `server/serve-file.ts` | server | `isMediaKey`, `serveFile` |
| `server/forget.ts` | server | `forgetUser`, for account deletion |
| `page/moderation.ts` | browser | the `$moderated` decorator, `configureModeration`, `submitToServer` |
| `page/photo.ts` | browser | `photoFor`, `ownPhotoOf`, `dataUrlOf` |

## Not yet

- The review queue extension (`extensions/queue/`).
- The device controller for a photo you sent (the source's `avatar` controller).
- A page helper that speaks the queue for a kind that is no model.

## Checks

- `light typecheck @lightstart/moderation`
- `light test @lightstart/moderation`
- `light check --all`
