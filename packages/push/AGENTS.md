# Working on @lightstart/push

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public surface: the types, the `push` controller and the two events |
| `types.ts` | `PushTarget`, `PushMessage`, `PushDevice`, `PushOutcome`, `PushEnv`, `PushState` and the command answers |
| `server/models.ts` | `pushModels`: `push_device`, `$permissions: none` |
| `server/device.ts` | `pushEndpoints`: `POST /api/push-device`, `access: "public"` |
| `server/send.ts` | `sendPush`, `serviceAccountOf`, `clearTokenCache`: FCM HTTP v1 with an RS256 JWT over Web Crypto |
| `server/contribute.ts` | The server contribution `light.server` names |
| `page/controller.ts` | The `push` controller and `configurePush` |
| `page/signals.ts` | `pushToken`, `pushReceived`, as events |
| `android/PushAddon.kt` | The `push` family, Firebase started from the app's string resources |
| `android/PushService.kt` | The `FirebaseMessagingService` that forwards or shows each push |
| `test/` | `send.test.ts`, `device.test.ts`, `controller.test.ts`, `addon.test.ts`, `addon-build.test.ts` |

## Rules the sources keep

- `server/` uses Web APIs only (Web Crypto, `TextEncoder`, `atob`, `fetch`) and reaches the database only through `D1Like`; no node module.
- `push_device` stays `$permissions: none`; only `POST /api/push-device` and `sendPush` read or write it.
- The endpoint ties `userId` to the caller's id or to empty; a token another device held is deleted before the upsert.
- A dead token is deleted only on `UNREGISTERED`, a 404, or an `INVALID_ARGUMENT` that names the registration token; every other refusal keeps the row.
- The OAuth token is cached until a minute before it expires and minted with an RS256 `crypto.subtle` signature; `sendPush` never throws.
- The page controller never throws to its caller. Outside the shell, `enable()` answers `{ error: "push needs the mobile shell", status: 0 }`.
- State is a prop (`status`, `deviceId`); an occurrence is an event (`pushToken`, `pushReceived`).
- Firebase is initialized in code from the `light_push_*` string resources, never the `google-services` plugin or JSON.
- `PushService` declares `actions: ["com.google.firebase.MESSAGING_EVENT"]` under `light.android.services`, so the shell writes its intent filter; the `light_push_*` strings come from the app's `defineMobile({ strings })`.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports.
- Gradle tests run offline and skip on the missing artifact, naming it.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| The `POST /api/push-device` body and answers | the page controller, and apps calling it |
| `pushModels`, `pushEndpoints`, `sendPush`, `serviceAccountOf` | an app's server |
| `FCM_SERVICE_ACCOUNT_JSON`, `FCM_PROJECT_ID` | a deploy's secrets |
| The `push_device` table shape | a migration and `sendPush` |
| The `push` controller (`status`, `deviceId`, `enable`), `pushToken`, `pushReceived` | an app's views |
| The `light_push_*` strings in `defineMobile({ strings })` | an app's Android shell |
| The `PUSH:PERMISSION` and `PUSH:TOKEN` commands, `push:token` and `push:received` events | the Android add-on and the page |

## Gates

From the repository root:

```bash
light typecheck @lightstart/push
light test @lightstart/push
light check --all
```
