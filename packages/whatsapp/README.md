# @lightstart/whatsapp

Connecting an account to WhatsApp without the person typing a number, and signing in with it. The app hands a signed-in person a six-digit code; they send it from their own WhatsApp to the business number; Meta posts the message to the webhook, which matches the code and records who sent it against that account. What the account then holds is the sender WhatsApp names them by, their number when WhatsApp shares it, their username and their country. Signing in is the same message from somebody with no session: the device holds a nonce beside the code, and redeems it once the code arrives.

The package names no app. The words around the code (what the person sends, what the app says) are the host app's.

## What a project declares

- **The dependency**, so the three tables join its schema and the four endpoints are served. `@lightstart/api` and `@lightstart/auth` must be declared too: the identity is served by the auth core's `POST /api/auth/identity/:name`.
- **The secrets**, in `.env` for the dev server and as deploy secrets:

  | name | what it is |
  |---|---|
  | `WHATSAPP_APP_SECRET` | the Meta app's secret; every delivery's `X-Hub-Signature-256` is checked against it |
  | `WHATSAPP_VERIFY_TOKEN` | the token set beside the webhook address on the Meta app, which the handshake must repeat |
  | `WHATSAPP_NUMBER` | the business number people send the code to, handed back with each code |
  | `WHATSAPP_PHONE_NUMBER_ID` | that number's id; a delivery for any other of the business's numbers is dropped, and the reply asking for a number is sent from it |
  | `WHATSAPP_TOKEN` | a system-user token with `whatsapp_business_messaging`, for that reply |
  | `WHATSAPP_ASK_TEXT` | optional: the wording of the reply asking for a number |

  The login code's address digest is salted with `RATE_SALT`, else `JWT_SECRET` (from `@lightstart/visitor`).
- **The webhook address** on the Meta app: `https://<origin>/api/whatsapp-webhook`, subscribed to `messages` and `user_id_update`.
- **A hook**, when the app wants to act on a confirmed code (see "Telling the app").

## The tables

| model | who reads it | what it holds |
|---|---|---|
| `whatsapp_account` | its owner | one row per connected account, under the account's id: `sender`, `waId`, `username`, `country`, `connectedAt` |
| `whatsapp_code` | nobody | the codes handed out: `code`, `expiresAt`, `usedAt`, `purpose` (`connect` or `login`), and who sent it (`sender`, `waId`, `username`, `country`); a login code keeps the digest of its nonce (`nonceHash`) and of the address it was asked from (`ipHash`), the push id of the device that asked when it sent one (`deviceId`), and when it was redeemed (`redeemedAt`) |
| `whatsapp_message` | nobody | every message the webhook took, by its WhatsApp id: `sender`, `matched`, swept after a week |

`sender` is the person's business-scoped user id (`BR.13491208655302741918`), or `+<waId>` when WhatsApp sent none, and no two accounts hold the same one. `waId` is the number exactly as WhatsApp sent it, empty while it withholds it. Nothing writes these tables through the model router; the endpoints clear a caller through `whatsapp_account`, the one of the three a person may read.

## The endpoints

| endpoint | who | answers |
|---|---|---|
| `POST /api/whatsapp-code` | signed in | `{ code, expiresAt, to }`, `to` being `WHATSAPP_NUMBER`; a 429 after five in an hour |
| `POST /api/whatsapp-login` | anybody | `{ code, nonce, expiresAt, to }`, a code to sign in with and the nonce to redeem it with; a 429 after ten in an hour from one address, a 503 while five hundred wait. The body may carry `{ deviceId }` (16 to 64 letters, digits, `-` or `_`; anything else is kept as none) |
| `GET /api/whatsapp-status` | signed in | `{ state, number, username }`, `state` one of `none`, `waiting`, `connected`, `expired`; a connected account that asked for another code is `waiting` until it is used or runs out |
| `GET /api/whatsapp-webhook` | Meta | the handshake: `hub.challenge` as text when the mode is `subscribe` and the token is `WHATSAPP_VERIFY_TOKEN`, a 403 otherwise |
| `POST /api/whatsapp-webhook` | Meta | a 401 when the signature over the delivery is not right; a 200 for everything else |

## The rules

- **A code** is six digits, good for ten minutes and used once. A new one ends the person's older ones, five an hour is the most, and no value any code took in the last day is handed out again, so a code names one account.
- **A message** connects when its text holds a waiting code standing on its own (`meu código: 482913.` matches, `1482913` does not). The code is marked used only if nobody used it first. The sender and the number are taken off any other account, so the newest confirmation holds them, and the account is written.
- **No number.** WhatsApp may leave the number out for a person with a username. The account is connected all the same, and the webhook replies with a `request_contact_info` message. The number the person then shares (a `contacts` message whose `origin` is `contact_request`) fills in `waId`. A contact card shared any other way is ignored, since it may be anybody's.
- **WhatsApp moving a person** moves their account: `user_id_update` to the new business-scoped id, and a `user_changed_number` system message to the new number.
- **Repeats and noise.** A message seen before, by its WhatsApp id, is dropped. A sender whose last five texts in an hour matched no code is not listened to for the rest of it. Delivery receipts and every kind of message but texts and requested contacts are dropped.

## Signing in

- **A login code** is a code like any other, under `purpose: "login"` and no account. The device keeps the nonce `POST /api/whatsapp-login` handed it (in its own storage, never in a URL); the row keeps only the nonce's SHA-256. Login codes a day old are swept.
- **The message** that carries one is stamped with who sent it and connects nothing: `receive` answers `login` and leaves `whatsapp_account` alone.
- **Redeeming** is `POST /api/auth/identity/whatsapp` with `{ nonce }`, which the auth core hands to the registered identity. It answers still waiting until the message arrives, then once: a conditional write on `redeemedAt` means a second redeem is refused, and so is one past the code's ten minutes. It names the account already connected to that sender (`whatsapp_account.sender`), or nobody, in which case the auth core makes an account with no email and `link` connects it the way a connect code would. There is no reply on WhatsApp.
- **Only a business-scoped id signs in.** A sender WhatsApp named by `+<number>` alone is refused with a 422: a number can pass to somebody else, and would sign them into its old owner's account.
- **Connect codes are apart.** Issuing one and asking where connecting stands read `purpose = 'connect'` only, so a login row, which has no account, is nobody's code. Deleting an account takes the login codes its sender redeemed.

The identity is registered when the package's server contribution module is imported, with `registerIdentity({ name: "whatsapp", redeem })` from `@lightstart/auth/server`. Nothing in the app wires it.

## Telling the app

The webhook calls every hook registered with `registerWhatsappHook` once per confirmed code, after it has written the code's outcome:

```js
import { registerWhatsappHook } from "@lightstart/whatsapp/server";

registerWhatsappHook(async ({ purpose, userId, deviceId, env, db }) => {
  // purpose is "connect" with the account, or "login" with the device that asked
});
```

Register it at import time from one of the app's `src/endpoints/*.ts` modules (the server entry imports them), or from a module they import. `db` is the webhook's `D1Like` database and `env` its environment. A hook that throws is skipped, so it cannot fail Meta's delivery or the other hooks. A repeated delivery confirms nothing, so the hook runs once per code. `clearWhatsappHooks()` is a test's seam.

| `purpose` | when | names |
|---|---|---|
| `connect` | a signed-in person's code arrived and their account is connected | `userId`, the account |
| `login` | a sign-in code arrived; the device is not signed in until it redeems it | `deviceId`, what the device sent with `POST /api/whatsapp-login`, empty when it sent none |

## On the page

The `whatsapp` controller from `@lightstart/whatsapp/page` never throws; every method answers `{ ok: true, ... } | { error, status }`.

```js
import whatsapp from "@lightstart/whatsapp/page";

const connected = await whatsapp.requestConnectCode(); // { ok, code, expiresAt, to }
const status = await whatsapp.refresh();               // { ok, state, number, username }
const done = await whatsapp.connect({ intervalMs: 3000 });
const session = await whatsapp.signIn({ deviceId: "phone-android-0001", timeoutMs: 10 * 60 * 1000 });
```

`signIn` asks for a login code and nonce, keeps the code and the number to send it to in `code` and `to`, then polls `auth.signInWithIdentity("whatsapp", { nonce })` every few seconds until it is no longer pending or the wait ends. A network failure is `{ error, status: 0 }`. A view follows `state`, `number`, `username`, `code`, `to` and `expiresAt` with `sync: "whatsapp"`.

`waMeHref(target, text)` is the `wa.me` link opening a chat with a number written any usual way (`+55 21 98765-4321`) or a username (`@ana.rio`), with `text` typed in. `normalizeGroupInvite(raw)` answers `https://chat.whatsapp.com/<code>` for an invite pasted with or without the scheme, any query dropped, or empty for anything else. `readInvite(html)` reads a group's invite page as a link preview: `{ name, image, dead }`, keeping the photo only when `isGroupPhoto` says it is https on `GROUP_PHOTO_HOST` (`pps.whatsapp.net`).

## On the server

`@lightstart/whatsapp/server` exports what an app's own code calls:

- `whatsappSession(userId, db)` answers `{ number, username, country }` or null, for the session.
- `forgetWhatsapp(userId, db)` takes the connection, the codes, the login codes and the messages the sender sent, for account deletion.
- `whatsappLogin` is the identity source for signing in; `issueLogin(db, ipHash, { deviceId })` and `redeemLogin(db, nonce)` are its two halves.
- `receive(db, events, env)` answers a receipt per event, `{ outcome, userId, deviceId }`: what became of it, the account it touched, and for a login code the device that asked for it.
- `signatureOf(rawBody, secret)`, `verifySignature` and `verifyChallenge` are Meta's checks, for tests and local tooling.

## Not yet

The `light whatsapp:send` command that signs a delivery to a running dev server is not ported. Build a delivery with the fixtures under `test/fixtures/webhooks/`, sign it with `signatureOf(raw, secret)`, and post it to `/api/whatsapp-webhook` with the `X-Hub-Signature-256` header.
