# Working on @lightstart/moderation

What the package is and how to use it: [README.md](README.md). This file is
what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The shared names: statuses, `REVIEW_MOVES`, `mintSubmissionId`, `payloadOf`, `submissionOf`, `pendingOf`, `provenanceOf`, `published` |
| `types.ts` | The shared types, the `$moderated` schema directive, `StorageLike` |
| `server/models.ts` | `moderationModels`: `submission` and `moderation_avatars`, `$permissions: none` |
| `server/policy.ts` | `submissionPolicy`: `beforeCreate`, `beforeUpdate`, `beforeRemove`, and the model publishing |
| `server/index.ts` | `@lightstart/moderation/server`: `forgetUser`, the policy and kinds, the models, the file and image helpers, for an app's endpoints and `src/server.js` |
| `server/contribute.ts` | The contribution `light.server` names: models, `moderationEndpoints` |
| `server/image.ts` | `readImageDataUrl`, `IMAGE_LIMITS` |
| `server/avatar.ts` | `avatar`, `sizedPicture`, `queueProviderAvatar` |
| `server/serve-file.ts` | `isMediaKey`, `serveFile` |
| `server/storage.ts` | `storageOf` |
| `server/forget.ts` | `forgetUser`, `forgetUserWith` |
| `page/moderation.ts` | `moderated`, `configureModeration`, `submitToServer`, `viewerFromToken` |
| `page/photo.ts` | `photoFor`, `ownPhotoOf`, `dataUrlOf` |
| `page/index.ts` | The page surface |
| `queue/slots.ts` | `queueKinds`, the `queue.kinds` slot a kind describes itself through |
| `queue/lib.ts` | `titleOf`, `submissionItem`, `groupOf`, `groupItems`, `movesOf`, `payloadFields`, `sentAt` |
| `queue/controller.ts` | `moderationQueue`: the pending list and `approve`, `reject`, `remove` |
| `queue/extension.ts` | The `moderation` extension: `/admin/queue`, its controller and the avatar kind |
| `views/queue*.ts` | The five `moderation-queue-*` tags |
| `locales/{en,pt,es}.js` | The words those tags draw |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `test/` | `contribute.test.ts` (a project declaring api, auth and moderation), `policy.test.ts` (the phases over `d1Of`), `forget.test.ts`, `moderated.test.ts` (the decorator over a fake store), `queue.test.ts` (the controller over a fake fetch), `queue.browser.test.js` (the page in Chromium) |

## Rules the sources keep

- `server/` uses Web APIs and `D1Like` only: no node module, no Cloudflare
  type. Storage is `StorageLike`, narrowed from R2's bucket; a test passes a
  small memory object.
- The submission table stays `$permissions: none`. A person writes through
  `POST /api/moderation/submit`, which runs the policy; the CRUD routes never
  expose the queue.
- The policy stamps the id, status, sender, address digest and browser itself.
  Nothing a request says about them is trusted.
- A model kind publishes into its own table, encoded as `crudApp` encodes it
  (`buildInsertSQL`/`buildUpdateSQL`, objects as JSON text, booleans as 1 or 0)
  and carrying `provenance`. A payload field the table has no column for is
  dropped rather than extending the table.
- `provenance` is the first 24 hex characters of SHA-256 over the submission
  id. Publishing appends it only when the target table has the column, so a
  model that wants healing must declare `provenance`.
- The per-address cap counts the `submission` rows through `@lightstart/visitor`'s
  `perAddress`; `visits` is contributed beside the submission tables.
- `page/moderation.ts` registers the decorator when imported. The viewer and
  the submitter are module-level seams for a test; never read a global app.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header
  and JSDoc on exports. Tests are plain scripts on `@lightstart/test/assert.ts`.

- A submission is published into, or taken down from, only a server model that declares `$moderated` (`moderatedModelOf`), `.edit` only with `edit: true`. The table comes from the kind, never the payload or `targetType`. The contribution reads the moderated models from the `models` its `endpoints(env, models)` is given. Never accept a kind because its table exists: `users` would be one.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| The `$moderated` directive, the pending marker shape, `pendingOf` | a moderated model's views and the decorator |
| `provenanceOf`, `published` | the decorator's healing and an app watching a publish |
| `POST /api/moderation/submit`, `pending`, `mine`, the review routes | the page, the admin, and the queue to come |
| `submissionPolicy` and its kinds | an app that adds kinds of its own |
| `forgetUser` and auth's `onUserDeleted` | account deletion |
| `light.server` in `package.json` and the contributed models | `light db:migrate`, `light serve`, the deploy |
| `configureModeration`, `moderated` | an app's page |
| `queueKinds`, `QueueKind` and the `moderation-queue-*` tags | an app or a package with kinds of its own in the queue |
| `moderationQueue` and the `light.extension` route `/admin/queue` | an app that installs the review queue |

## Gates

From the repository root:

```bash
light typecheck @lightstart/moderation
light test @lightstart/moderation
light check --all
```

From `packages/moderation`, one browser file per run:

```bash
light test test/queue.browser.test.js
```
