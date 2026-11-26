# @lightstart/pix

Pix as a payment method for `@lightstart/billing`. The checkout asks the
server for a charge; the server sets the amount and a reference, records the
charge through billing, and answers it with the BR Code for that one payment.
The checkout then shows the code as a QR and as text to copy. Nothing of this
package runs on a server of its own: an admin confirms the payment later in
billing's `/admin/payments`, and the charge's amount, reference and payer are
what the statement is matched on.

## What a project declares

- **The packages.** `@lightstart/pix`, `@lightstart/billing` and
  `@lightstart/qr`, which draws `<qr-code>`.
- **The Pix method**, in the project's billing config, so a charge through Pix
  may keep the payer's name:

  ```js
  // src/billing.js
  providers: { pix: { data: ["payer"] } }
  ```

- **The Pix account**, as the server's environment. The key is printed in
  every code, so it is not a secret:

  | Variable | What it is |
  |---|---|
  | `PIX_KEY` | The Pix key payments go to: a random key, an email, a phone or a document |
  | `PIX_MERCHANT_NAME` | The merchant name the key is registered under (at most 25 characters reach the code) |
  | `PIX_MERCHANT_CITY` | The merchant city the key is registered under (at most 15 characters reach the code) |

  A server missing any of the three answers a 500 from the charge endpoint,
  rather than making a code that pays the wrong account.

## The BR Code

`lib/brcode.ts`, pure, the same in a browser and under node:

- **`brcode({ key, name, city, amount, txid })`** builds an EMV payload: GUI
  `br.gov.bcb.pix`, the key, the amount in reais with two decimals, the
  merchant name (25 characters) and city (15), the reference (25 letters and
  digits, `***` when there is none), and a CRC16-CCITT of it all.
- **`crc16(text)`** answers the four uppercase hex digits a BR Code closes
  with.
- **`pixText(text, max)`** folds accents and keeps what a merchant field can
  carry.

The test builds the static example from the Banco Central's BR Code manual, to
its checksum.

## `POST /api/pix/charge`

The package's `light.server` contribution adds this endpoint beside the app's
routes. It needs a signed-in caller.

```json
{ "plan": "place", "context": { "kind": "claim", "slug": "bar-bip-bip" }, "payer": "Bip Bip Bar Ltda" }
```

It reads the Pix account from the environment above, calls
`recordCharge(db, { userId, plan, provider: "pix", data: { payer }, context })`
from `@lightstart/billing/server`, and answers:

```json
{ "charge": { "id": "…", "status": "pending", "amount": 4900, "providerRef": "…" }, "code": "000201…6304ABCD" }
```

A signed-out caller is 401, an unknown plan or a method the project does not
take is 400, and a server with no Pix account is 500. Billing's own
contribution supplies the `charge` and `entitlement` tables.

## `<pix-checkout plan .context .charge .code .done>`

1. It asks the name on the paying account, starting from the signed-in
   account's own name.
2. "Show the Pix code" asks `POST /api/pix/charge`.
3. It shows the QR, the code to copy, the amount, two steps and the reference.
4. "I've paid" calls `done("pending", charge)`.

Handed a `charge` and its `code`, it starts at step 3 with that charge instead
of asking for a new one. A refused charge says so and asks again. Signed out,
it asks for a sign-in and nothing else.

The view follows the `auth` controller (`user`) and draws `qr-code`,
`lc-input`, `lc-button` and `lc-clipboard`, which an app on
`@lightstart/app` provides from the packages it declares.

## Files

| File | What it holds |
|---|---|
| `index.ts` | `brcode`, `crc16`, `pixText` and the types |
| `types.ts` | `PixCode`, `PixSettings`, `PixCharge` |
| `lib/brcode.ts` | The BR Code and its CRC16 |
| `server/charge.ts` | `POST /api/pix/charge` |
| `server/contribute.ts` | The contribution `light.server` names |
| `views/checkout.ts` | `<pix-checkout>` |
| `locales/{en,pt,es}.js` | The words the view draws |
| `tags.json` | The package's tag table |
| `test/` | The BR Code, the endpoint, and the checkout in Chromium |

## What changed from the source

- The BR Code is built on the server, from `PIX_KEY`,
  `PIX_MERCHANT_NAME` and `PIX_MERCHANT_CITY`, not in the browser from page
  settings. The endpoint answers the code with the charge.
- The charge goes through light's `recordCharge` endpoint instead of a model's
  `charge.add`, so the server alone stamps the owner, amount, currency,
  reference and status.
- The checkout follows the `auth` controller rather than reading an app
  global, and its words use light's translation contract.

## Checks

```bash
light typecheck @lightstart/pix
light test @lightstart/pix
light test test/checkout.browser.test.js   # from packages/pix
light check --all
```
