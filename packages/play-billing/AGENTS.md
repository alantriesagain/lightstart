# Working on @lightstart/play-billing

What the package is and how to use it: [README.md](README.md). This file is
what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public surface: `PLAY_PRODUCTS`, `PLAY_BUY` and the types |
| `types.ts` | `PlayEnv`, `PlaySubscription`, `PlayGrant`, `PlayProduct`, `PlayCheckoutProps` |
| `commands.ts` | The two bridge command names |
| `server/google.ts` | `serviceAccountOf`, `googleAccessToken`, `clearTokenCache`: an RS256 JWT over Web Crypto |
| `server/play.ts` | `accountIdFor`, `refOf`, `grantOf`, `purchaseResponse`, `notificationResponse`, `accountResponse`, `fetchOf` |
| `server/contribute.ts` | `playEndpoints`, and the `light.server` contribution |
| `server/index.ts` | The server surface |
| `page/checkout.ts` | `<play-checkout>` |
| `page/index.ts` | The page surface |
| `locales/{en,pt,es}.js` | The checkout's words |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `android/PlayBillingAddon.kt` | The `play` family: `PLAY:PRODUCTS` and `PLAY:BUY` |
| `test/` | `verify.test.ts` (a fake Play), `contribute.test.ts` (a project on api, auth and billing), `addon.test.ts`, `addon-build.test.ts` |

## Rules the sources keep

- `server/` uses Web APIs (Web Crypto, `TextEncoder`, `atob`, `fetch`) and
  `D1Like` only; no node module.
- A purchase is never believed from the request. The token is read back from
  Play's `subscriptionsv2`, and the account id it carries must be the HMAC of
  the caller's id, or the purchase is a 403.
- A purchase is acknowledged unless Play already says it was, since Play
  refunds an unacknowledged one within three days.
- A grant is `grantUntil` under source `play`, the reference a digest of the
  purchase token, so the same purchase is one period and a renewal moves its
  end. A revocation calls `revokeRef`, and a revoked period stays revoked.
- The RTDN endpoint verifies the `?token=` value against `PLAY_RTDN_TOKEN`, the
  same thing the source verified; anything else is a 403, and a token this app
  never granted is ignored.
- Google's token is an RS256 signature over `crypto.subtle`, cached until a
  minute before it expires; Google's APIs go through `PLAY_FETCH` when a test
  injects one.
- The page asks the shell with the source's command names and never talks to
  Play itself.
- The add-on is family `play`; `light.android` names the permission and the
  billing library at the source's version (`8.3.0`).
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header
  and JSDoc on exports. Tests are plain scripts on
  `@lightstart/test/assert.ts`; the Gradle test runs offline and skips on the
  missing artifact, naming it.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `GET /api/play-account`, `POST /api/play-purchase`, `POST /api/play-rtdn` | the page, and an app's deploy |
| `purchaseResponse`, `notificationResponse`, `accountIdFor`, `grantOf`, `refOf` | server code calling Play without the routes |
| `PLAY_SERVICE_ACCOUNT_JSON`, `PLAY_PACKAGE_NAME`, `PLAY_RTDN_TOKEN`, `JWT_SECRET` | a deploy's secrets |
| `PLAY:PRODUCTS` and `PLAY:BUY` | the page and the Android add-on |
| `<play-checkout>`'s `plan` and `done` | an app's checkout view |
| `light.android`'s permission and `billing` dependency | `light mobile:init` |

## Gates

From the repository root:

```bash
light typecheck @lightstart/play-billing
light test @lightstart/play-billing
light check --all
```
