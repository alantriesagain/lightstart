# @lightstart/auth

Sign-in by a code mailed to an address, and a JWT session. No passwords. The server half answers `/api/auth/*` on `@lightstart/api`'s server and resolves the caller its permissions and endpoints see; the page half is the `auth` controller, which hands the session to every `api` store request.

## The server

Declaring the package is the whole setup. Its `package.json` names a server contribution (`light.server`), so every app on `@lightstart/api` that depends on it gets three things with nothing to wire:
- the `users` and `auth_codes` tables, which `light db:migrate` creates;
- the routes below;
- the session as the caller for its endpoints and `$permissions`.

Locally, `light serve` mails codes to its console. Deployed, they go through Resend when `RESEND_API_KEY` is set.

| Route | Body | Answers |
|---|---|---|
| `POST /api/auth/otp` | `{ email }` | `{ ok: true }`: a 6-digit code mailed, valid 10 minutes |
| `POST /api/auth/verify` | `{ email, code }` | `{ token, user }`: the account is made on the first sign-in |
| `GET /api/auth/me` | | `{ user }` |
| `PATCH /api/auth/profile` | the fields `profileFields` allows (`["name"]`) | `{ user }` |
| `POST /api/auth/refresh` | | `{ token, user }` |
| `POST /api/auth/delete` | | `{ ok: true }`, after `onUserDeleted` |

How the code is handled:
- The address is lower-cased and trimmed.
- A new code for the same address is refused within 30 seconds (429).
- A code takes 5 tries. Each try is counted in one statement before the comparison, so parallel guesses can't share a count.
- The table keeps an HMAC of the code keyed by `JWT_SECRET` and the address, never the code.

The session is an HS256 JWT (`{ sub, admin?, exp }`, 30 days) signed with `JWT_SECRET`, at least 32 bytes. A token without `exp`, with another `alg`, or with a bad signature is no session. Everything uses Web Crypto, so the server runs in Workers as well as node.

`callerFromRequest(env, db)` is the caller for `serverApp`. Given the database, a token whose user was deleted is nobody, and `admin` is read from the row, so a deleted account or a revoked admin takes effect at once.

`users` and `auth_codes` are `$permissions: none`, so the CRUD routes never expose them; only the auth routes touch them.

Hooks are `{ onUserDeleted(id, db, env), sessionFields(id, db, env) }`, registered from the app's `src/server.js` with `registerAuthHooks` (every registered `onUserDeleted` runs in order; `sessionFields` merge). `sessionFields` adds fields to the person's own user wherever one is answered.

`mailerFrom(env, log)` picks the mailer: Resend (`RESEND_API_KEY`, from `AUTH_FROM_EMAIL`) when the key is set, else a console mailer that logs the code, for development.

## Identities

A package adds another way in by registering an identity when its server contribution is imported:

```ts
import { registerIdentity } from "@lightstart/auth/server";

registerIdentity({
  name: "whatsapp",
  redeem: async (body, db, env) => ({ userId: null, name: "Sam", link: async (userId) => { /* keep it */ } }),
});
```

`POST /api/auth/identity/:name` (public) calls the identity's `redeem`, which answers one of:
- `{ pending: true }`: the route answers 202 and the device asks again;
- `{ error, status }`: that status, with the message;
- `{ userId: string | null, name?: string, link(userId) }`, the account the identity names.

With no session, a null `userId` makes an account with a NULL email, calls `link(newId)` and answers `{ token, user }`; an existing `userId` signs that account in (401 when it is gone). With a session, a null `userId` links the identity to the caller and answers the caller's session; the caller's own `userId` answers it; another account's is 409 `{ error: "linked to another account" }`, since accounts are never merged. An unknown name is 404.

`registerIdentity` keeps a module-level registry, so registering a name twice from different objects throws naming it; `identityNamed(name)` reads one and `resetIdentities()` clears them for a test.

## The page

```js
import auth, { safeNext } from "@lightstart/auth/page";

await auth.requestCode("me@example.com");
const signedIn = await auth.verifyCode("me@example.com", "123456"); // { ok, user } | { error, status }
if (signedIn.ok) navigate(safeNext(currentRoute.value?.query.next));
```

`auth` is a `defineController` literal named `auth`. A view follows `user` and `loaded` with `sync: "auth"`.
- **Methods:** `requestCode`, `verifyCode`, `signInWithIdentity`, `signOut`, `updateProfile`, `deleteAccount` and `reload`. Each answers `{ ok } | { error, status }` and never throws; a network failure has status 0. `signInWithIdentity(name, body)` also answers `{ pending: true }` for a waiting device.
- **The token** lives in `localStorage`, and `configureApi({ token })` hands it to every `api` store request.
- **A 401** on a call that carried the session signs out.
- **`safeNext(target)`** is the page's mirror of `@lightstart/server`'s `safeRedirect` for a path. It refuses a protocol-relative target, a backslash, a control character anywhere, an absolute URL and leading whitespace, and answers `/` instead.

## Not yet

- A per-address limit on code requests exists, but no per-IP limit across addresses.
- OAuth (Google, GitHub).
- Read-only admin sessions.
