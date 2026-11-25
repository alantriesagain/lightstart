# @lightstart/auth

Sign-in by a code mailed to an address, and a JWT session. No passwords. The server half answers `/api/auth/*` on `@lightstart/api`'s server and resolves the caller its permissions and endpoints see; the page half is the `auth` controller, which hands the session to every `api` store request.

## The server

```js
// the app's server (src/server.js, or wherever createServer is called)
import { authEndpoints, authModels, callerFromRequest, mailerFrom } from "@lightstart/auth/server";

const server = createServer({
  models: { ...authModels, ...models },
  endpoints: [...authEndpoints({ mailer: mailerFrom(env, console.log) }), ...endpoints],
  db: () => env.DB,
  caller: callerFromRequest(env, () => env.DB),
  env,
});
```

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

Hooks are `{ onUserDeleted(id, db, env), sessionFields(id, db, env) }`. `sessionFields` adds fields to the person's own user wherever one is answered.

`mailerFrom(env, log)` picks the mailer: Resend (`RESEND_API_KEY`, from `AUTH_FROM_EMAIL`) when the key is set, else a console mailer that logs the code, for development.

## The page

```js
import auth, { safeNext } from "@lightstart/auth/page";

await auth.requestCode("me@example.com");
const signedIn = await auth.verifyCode("me@example.com", "123456"); // { ok, user } | { error, status }
if (signedIn.ok) navigate(safeNext(currentRoute.value?.query.next));
```

`auth` is a `defineController` literal named `auth`. A view follows `user` and `loaded` with `sync: "auth"`.
- **Methods:** `requestCode`, `verifyCode`, `signOut`, `updateProfile`, `deleteAccount` and `reload`. Each answers `{ ok } | { error, status }` and never throws; a network failure has status 0.
- **The token** lives in `localStorage`, and `configureApi({ token })` hands it to every `api` store request.
- **A 401** on a call that carried the session signs out.
- **`safeNext(target)`** is the page's mirror of `@lightstart/server`'s `safeRedirect` for a path. It refuses a protocol-relative target, a backslash, a control character anywhere, an absolute URL and leading whitespace, and answers `/` instead.

## Not yet

- A per-address limit on code requests exists, but no per-IP limit across addresses.
- OAuth (Google, GitHub).
- Identities an app adds (a WhatsApp code).
- Read-only admin sessions.
