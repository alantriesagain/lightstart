# Working on @lightstart/auth

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `AuthUser` |
| `server/jwt.ts` | `signToken`, `verifyToken`: HS256 over Web Crypto |
| `server/models.ts` | `authModels`: `users` and `auth_codes`, `$permissions: none` |
| `server/routes.ts` | `authEndpoints`: the `/api/auth/*` endpoints, `MAX_TRIES`, `RESEND_MS` |
| `server/caller.ts` | `callerFromRequest(env, db?)` |
| `server/contribute.ts` | The server contribution `light.server` names: `authModels`, `authEndpoints` with `mailerFrom(env)`, `callerFromRequest(env, db)` |
| `server/mailer.ts` | `resendMailer`, `consoleMailer`, `mailerFrom` |
| `page/controller.ts` | The `auth` controller |
| `page/session.ts` | The token store and `configureAuth` |
| `page/next.ts` | `safeNext` |
| `test/` | `server.test.ts` (over `serverApp` and `d1Of`), `page.test.ts` (over a fake fetch), `contribute.test.ts` (a project declaring the package: its tables, entry and routes) |

## Rules the sources keep

- `server/` uses Web Crypto and `TextEncoder` only, never a node module, and reaches the database only through `D1Like`.
- A code is never stored, logged by the server, or answered; the table holds `HMAC(JWT_SECRET, email + "\n" + code)`. A try is counted with `UPDATE … SET tries = tries + 1 … RETURNING` before the comparison; never read, compare, then write a count.
- `verifyToken` refuses a missing `exp`, another `alg`, and a bad signature (compared by `crypto.subtle.verify`). A secret under 32 bytes refuses to sign.
- `users` and `auth_codes` stay `$permissions: none`; only the auth routes read or write them, so `/profile` writes only `profileFields`.
- A redirect after sign-in goes through `@lightstart/server`'s `safeRedirect` on the server and `safeNext` on the page; never compare a `next` by hand. `safeNext` keeps `safeTarget`'s rule for paths.
- The page controller never throws to its caller; a 401 on a call made with the session signs out.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| The `/api/auth/*` routes and their bodies | the page controller, and apps calling them |
| `authModels`, `authEndpoints`, `callerFromRequest`, `mailerFrom` | an app's server |
| `JWT_SECRET`, `RESEND_API_KEY`, `AUTH_FROM_EMAIL` | the deploy's secrets |
| The `auth` controller (`user`, `loaded`, its methods), `safeNext` | an app's views |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/auth
light test @lightstart/auth
```
