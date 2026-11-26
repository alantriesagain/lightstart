# @lightstart/push

Remote push notifications to the Android shell, through Firebase Cloud
Messaging HTTP v1. A device registers the token FCM gave it under the account
it is signed in to. Server code sends to every device of an account or to one
device, and a device whose token FCM no longer knows is deleted.

iOS is left out: light's mobile shell is Android-only.

## The server

Declaring the package is the whole setup. Its `package.json` names a server
contribution (`light.server`), so every app on `@lightstart/api` that depends on
it gets, with nothing to wire:

- the `push_device` table, which `light db:migrate` creates;
- `POST /api/push-device`, the route a device registers at.

The table is `$permissions: none`, so the CRUD routes never expose it. Only the
endpoint and `sendPush` read or write it.

| Route | Body | Answers |
|---|---|---|
| `POST /api/push-device` | `{ id, token, platform, locale }` | `{ ok: true }` |

The endpoint is `access: "public"`: anybody may register, a visitor included,
and the device id is the only key. It refuses a device id that is not 16 to 64
letters, digits, `-` or `_`, an empty token, a platform other than `android` or
`ios`, and a locale that is not a language tag, each with a 400. It ties the
row to the caller's account when the request carries a session, or to nobody
when it does not, which is how a device that signed out stops receiving that
account's pushes. A token another device held moves to this one.

### Sending

```js
import { sendPush } from "@lightstart/push/server";

waitUntil(
  sendPush(env, db, { userId }, { id: `alert:asked:${rsvpId}`, title, body, url: `/live/${liveId}` }),
);
```

- `target` is `{ userId }` (every device signed in to the account) or
  `{ deviceId }`. An empty value reaches nobody, never every signed-out device.
- `message` is `{ id, title, body, url }`, the same for every device, or a
  function of a device's `locale` (the tag it registered with, empty when it
  sent none) answering that device's message, so an account with a phone in
  Portuguese and a tablet in English gets each in its own language.
- An empty `url` opens the app where it was, with no navigation.
- It answers `{ devices, sent, pruned, failed, dev }` and never throws:
  whatever goes wrong is logged and counted.
- A device FCM calls `UNREGISTERED`, or whose token it calls invalid, is
  deleted. Any other refusal leaves it for the next push.
- Android gets a data-only message, so the app decides how to show it; iOS
  (were it supported by the shell) would get an APNs alert with `id` and `url`.

The bearer is minted from the service account in `FCM_SERVICE_ACCOUNT_JSON`:
RS256 over Web Crypto (`crypto.subtle.importKey("pkcs8", …)`), so it runs in a
Worker. It is cached until a minute before it expires. Messages go to the
service account's own `project_id`, or to `FCM_PROJECT_ID` when the Firebase
project is another one that granted the account the FCM role.

Without `FCM_SERVICE_ACCOUNT_JSON`, nothing is sent: one `[push:dev]` line is
logged per message (per locale, for a function), naming the target and what it
says.

```
[push:dev] user=u_ana devices=1 id=alert:asked:r1 title="Bia wants to join" body="Sunset at Arpoador" url=/live/l1
```

`sendPush` takes an optional fifth argument `{ fetchImpl, now }` so a test can
stand in a fake FCM and a fixed clock. `clearTokenCache()` forgets the cached
OAuth tokens.

## The page

```js
import { push, pushReceived, configurePush } from "@lightstart/push/page";

pushReceived.on((message) => console.log("push", message.id, message.url));

const answer = await push.enable(); // { ok: true, status } | { error, status }
```

`push` is a `defineController` literal named `push`.

- **`status`**: `"off"`, `"on"` once this device registered, or `"denied"` when
  the person refused; kept on the device.
- **`deviceId`**: the id this device registers under, made once and kept on the
  device. A server sends to it with `sendPush(env, db, { deviceId })`.
- **`enable()`**: asks for permission (`PUSH:PERMISSION`), reads the token
  (`PUSH:TOKEN`) and registers it at `POST /api/push-device`, with the session
  when there is one; answers the state it leaves. A call while pushes are
  already on or were refused changes nothing. Outside the shell it answers
  `{ error: "push needs the mobile shell", status: 0 }`.
- **`pushToken`** and **`pushReceived`** are events (`event` from light's
  signals): a new FCM token, and a push that arrived while the app is on
  screen. A new token registers the device again.

The registration carries this device's `id`, token, `platform` and `locale`,
and a `Bearer` session when one is stored. By default the session comes from
`@lightstart/auth`'s `localStorage` key; `configurePush({ token })` names
another. `configurePush` also takes `mobile`, `fetch`, `storage`, `locale` and
`prefix`, the seams a test or a different host needs.

## Android

The shell add-on is `android/PushAddon.kt` and `android/PushService.kt`, declared
under `light.android`: the `push` family, the `POST_NOTIFICATIONS` permission,
the `PushService` service, and
`com.google.firebase:firebase-messaging:25.1.3`.

The package has no iOS half.

### Firebase initialization

Light's add-on mechanism cannot add a Gradle plugin, so this add-on does not
use the `google-services` plugin or a `google-services.json`. Firebase is
started in code with `FirebaseOptions.Builder`, reading four **string
resources** the app declares in `src/mobile.js`, which `mobile:init` and
`mobile:sync` write into `res/values/strings.xml`:

```js
export default defineMobile({
  appId: "rio.meetup.app",
  strings: {
    light_push_project_id: "meetup-rio",
    light_push_app_id: "1:123:android:abc",
    light_push_api_key: "AIza…",
    light_push_sender_id: "123",
  },
});
```

| Resource | In `google-services.json` |
|---|---|
| `light_push_project_id` | `project_info.project_id` |
| `light_push_app_id` | `client[].client_info.mobilesdk_app_id` |
| `light_push_api_key` | `client[].api_key[0].current_key` |
| `light_push_sender_id` | `project_info.project_number` |

They travel inside every APK and are not secrets. The `MESSAGING_EVENT` intent filter FCM delivers through is declared on `PushService` in the package's `light.android.services`, so the shell carries it with nothing to add. With any of them empty the
shell reports no `push` family and both commands answer `unconfigured`.

### What the app must still provide

- The four strings above, in `defineMobile({ strings })`.
- A Firebase project with the Android app (its package name) added.
- A service account allowed to send through the Firebase Cloud Messaging API,
  with that API enabled in the Firebase project's Google Cloud project. Its JSON
  key is `FCM_SERVICE_ACCOUNT_JSON`. When the account lives in another Google
  Cloud project than Firebase, `FCM_PROJECT_ID` names the Firebase project.

The Gradle plugin (`com.google.gms.google-services`) and
`google-services.json` are **not** needed.

## What the owner sets up

1. A Firebase project with the Android app, registered with the shell's
   `appId`.
2. The service account and `FCM_SERVICE_ACCOUNT_JSON`, as above.

## Files

| File | What |
|---|---|
| `types.ts` | `PushTarget`, `PushMessage`, `PushDevice`, `PushOutcome`, `PushEnv`, `PushState` and the command answers |
| `server/models.ts` | `push_device`, `$permissions: none` |
| `server/device.ts` | `POST /api/push-device` |
| `server/send.ts` | `sendPush`: FCM HTTP v1 with an RS256 service-account JWT |
| `server/contribute.ts` | The contribution `light.server` names |
| `page/controller.ts` | The `push` controller and `configurePush` |
| `page/signals.ts` | `pushToken`, `pushReceived` |
| `android/PushAddon.kt` | The `push` family and Firebase started from the app's resources |
| `android/PushService.kt` | The `FirebaseMessagingService` that forwards or shows each push |
