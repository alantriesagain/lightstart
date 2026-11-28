# Working on @lightstart/auth

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `AuthUser` |
| `server/jwt.ts` | `signToken`, `verifyToken`: HS256 over Web Crypto |
| `server/models.ts` | `authModels`: `users` and `auth_codes`, `$permissions: none` |
| `server/identities.ts` | `registerIdentity`, `identityNamed`, `resetIdentities`: the identities registry |
| `server/routes.ts` | `authEndpoints`: the `/api/auth/*` endpoints, `MAX_TRIES`, `RESEND_MS` |
| `server/caller.ts` | `callerFromRequest(env, db?)` |
| `server/contribute.ts` | The server contribution `light.server` names: `authModels`, `authEndpoints` with `mailerFrom(env)`, `callerFromRequest(env, db)` |
| `server/mailer.ts` | `resendMailer`, `cloudflareMailer`, `consoleMailer`, `mailerFrom` |
| `page/controller.ts` | The `auth` controller |
| `page/session.ts` | The token store and `configureAuth` |
| `page/next.ts` | `safeNext` |
| `test/` | `server.test.ts` and `identity.test.ts` (over `serverApp` and `d1Of`), `page.test.ts` (over a fake fetch), `contribute.test.ts` (a project declaring the package: its tables, entry and routes) |

## Rules the sources keep

- `server/` uses Web Crypto and `TextEncoder` only, never a node module, and reaches the database only through `D1Like`.
- A code is never stored, logged by the server, or answered; the table holds `HMAC(JWT_SECRET, email + "\n" + code)`. A try is counted with `UPDATE … SET tries = tries + 1 … RETURNING` before the comparison; never read, compare, then write a count.
- `verifyToken` refuses a missing `exp`, another `alg`, and a bad signature (compared by `crypto.subtle.verify`). A secret under 32 bytes refuses to sign.
- `users` and `auth_codes` stay `$permissions: none`; only the auth routes read or write them, so `/profile` writes only `profileFields`. `users.email` is unique but not required: an account an identity makes is written with a NULL email, never `""`, since SQLite allows many NULLs under a unique index.
- An identity is registered under its name in `server/identities.ts`; a second object naming the same identity throws. `POST /api/auth/identity/:name` is public and reads the caller when there is one; accounts are never merged, so another account's identity is 409.
- A redirect after sign-in goes through `@lightstart/server`'s `safeRedirect` on the server and `safeNext` on the page; never compare a `next` by hand. `safeNext` keeps `safeTarget`'s rule for paths.
- The page controller never throws to its caller; a 401 on a call made with the session signs out.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| The `/api/auth/*` routes and their bodies, including the provider-less `GET /api/auth/oauth/callback` that reads the provider from the state cookie | the page controller, and apps calling them |
| `authModels`, `authEndpoints`, `callerFromRequest`, `mailerFrom` | an app's server |
| `registerIdentity`, the `Identity` and `IdentityAnswer` shapes, `/api/auth/identity/:name` | a package adding a way in, such as a chat app |
| `JWT_SECRET`, `RESEND_API_KEY`, `AUTH_FROM_EMAIL`, `CF_ACCOUNT_ID`, `CF_EMAIL_TOKEN`/`CF_API_TOKEN`, `FROM_EMAIL`, `AUTH_OAUTH_REDIRECT_PATH` | the deploy's secrets and the OAuth redirect an app registered |
| The `auth` controller (`user`, `loaded`, its methods including `signInWithIdentity` and `forwardOAuthCallback`), `safeNext` | an app's views |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/auth
light test @lightstart/auth
```
