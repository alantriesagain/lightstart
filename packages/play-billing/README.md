# @lightstart/play-billing

Google Play subscriptions as a payment method for `@lightstart/billing`.
Purchases are verified with the Play Developer API on the server, recorded in
billing's ledger, and followed through Play's real-time developer
notifications. An app asks billing whether an account holds a plan; this
package is one way the ledger learns it.

The product ids are the project's plan ids, so a grant's key is the product id
and nothing maps one to the other.

## How a subscription goes

1. `<play-checkout plan>` asks the Android shell's Play Billing add-on for the
   plan's product (`PLAY:PRODUCTS`) and shows its price and free days as Play
   states them for this device.
2. Subscribe asks the server for the account id this person's purchases carry
   (`GET /api/play-account`, an HMAC of their id under `JWT_SECRET`), then opens
   Play's own sheet with it (`PLAY:BUY`).
3. The purchase token Play hands back goes to `POST /api/play-purchase`. The
   server reads the subscription back from Play (never from the request),
   checks its account id is the caller's, grants the plan until the end Play
   states (`grantUntil`, source `play`, the reference a digest of the token)
   and acknowledges it, which Play requires within three days.
4. Play's real-time notifications arrive at `POST /api/play-rtdn?token=`. Each
   is read back from Play: a renewal moves the end, a revocation (a refund)
   takes the period back. A token this app never granted is left for the app to
   hand over.

## The server

Declaring the package is the whole setup. Its `package.json` names a server
contribution (`light.server`), so every app on `@lightstart/api` that depends on
it gets, with nothing to wire:

| Route | Who | What |
|---|---|---|
| `GET /api/play-account` | a signed-in person | `{ accountId }`, the id their purchases carry to Play |
| `POST /api/play-purchase` | a signed-in person | `{ purchaseToken }`, granted once Play says it is the caller's |
| `POST /api/play-rtdn?token=` | anyone with the token | Play's Pub/Sub push: renews, cancels or revokes |

The RTDN endpoint verifies what the source verified: the `token` query value
must equal `PLAY_RTDN_TOKEN`, the secret set on the Pub/Sub push subscription.
It does not verify a Pub/Sub JWT beyond that token. A call with another token
is a 403. A notification for a purchase this app never granted is ignored, so
the app can still hand it over.

The purchase and notification code is exported as `accountIdFor`, `refOf`,
`grantOf`, `purchaseResponse`, `notificationResponse` and `accountResponse`
from `@lightstart/play-billing/server`, so a server can call it without the
endpoints. `PLAY_FETCH` may hold a fetch for a test; Google's APIs go through
it instead of the page's.

The server uses Web APIs and `D1Like` only. The Play Developer API bearer is
minted from the service account's JSON key with an RS256 signature over Web
Crypto, cached until a minute before it expires.

## The page

`<play-checkout>` is the package's tag, drawn in the three languages under
`locales/`:

```html
<play-checkout plan="spot" .done=${(status, charge) => after(status)}></play-checkout>
```

- It asks the shell for the product with `mobile.request("PLAY:PRODUCTS", [{ ids: [plan] }])`
  and shows its price and trial days.
- Subscribe reads `GET /api/play-account`, then calls
  `mobile.request("PLAY:BUY", [{ productId, accountId }])`.
- The token Play answers goes to `POST /api/play-purchase`; a refused purchase
  leaves the view in its failed state with an alert.
- Signed out, it shows a sign-in line and asks nothing.
- Outside the Android shell, or for a plan with no product, it draws nothing.

## The Android add-on

`android/PlayBillingAddon.kt` implements the shell's `MobileAddon` in
`dev.lightstart.mobile.addons`, family `play`, and speaks `PLAY:PRODUCTS` and
`PLAY:BUY`. Its `light.android` block adds the `com.android.vending.BILLING`
permission and `com.android.billingclient:billing:8.3.0`. A project gets it
by declaring `@lightstart/play-billing` as a dependency and running
`light mobile:init`; changing native code means a new binary.

## What it needs

| Secret | What |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | A Google service account's JSON key, with access in the Play Console to view financial data and to manage orders and subscriptions |
| `PLAY_PACKAGE_NAME` | The app's package name, such as `app.example` |
| `PLAY_RTDN_TOKEN` | A long random string, set as `?token=` on the Pub/Sub push subscription |
| `JWT_SECRET` | The auth secret the Play account id is an HMAC under |

In the Play Console: one subscription per plan, its product id the plan id, a
monthly base plan, and an offer with the free days to start with. Real-time
developer notifications point at a Pub/Sub topic whose push subscription
targets `https://<site>/api/play-rtdn?token=<PLAY_RTDN_TOKEN>`.

The project's billing config takes the method and names the Play data fields,
if any: `providers: { play: {} }`.

## Files

| File | What |
|---|---|
| `index.ts` | The public surface: the command names and the types |
| `types.ts` | `PlayEnv`, `PlaySubscription`, `PlayGrant`, `PlayProduct`, `PlayCheckoutProps` |
| `commands.ts` | `PLAY_PRODUCTS` and `PLAY_BUY` |
| `server/google.ts` | `serviceAccountOf`, `googleAccessToken`, `clearTokenCache`: the RS256 bearer |
| `server/play.ts` | `accountIdFor`, `refOf`, `grantOf`, `purchaseResponse`, `notificationResponse`, `accountResponse` |
| `server/contribute.ts` | The `/api/play-*` endpoints and the `light.server` contribution |
| `page/checkout.ts` | `<play-checkout>` |
| `locales/{en,pt,es}.js` | Its words |
| `tags.json` | The package's tag table |
| `android/PlayBillingAddon.kt` | The `PLAY:*` bridge family |

## Checks

- `light typecheck @lightstart/play-billing`
- `light test @lightstart/play-billing`
- `light check --all`
