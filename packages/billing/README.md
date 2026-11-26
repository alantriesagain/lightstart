# @lightstart/billing

Paid features for any app: the plans a project sells, the charges that pay for
them, and a ledger of the periods each account holds. An app asks whether an
account holds a plan, never how it paid, so a payment method is a package of
its own (`@lightstart/pix`, `@lightstart/play-billing`) and records its charge
through this package's server methods.

This is part 1: the plans, the ledger, the server methods and endpoints, the
page controller, and the admin payments view. A client checkout belongs to a
payment method's package.

## What a project declares

Keep the plans in `src/billing.js` as plain data, so the page and the server
read the same thing:

```js
// src/billing.js
import { defineBilling } from "@lightstart/billing";

export default defineBilling({
  plans: {
    pro: { amount: 4900, currency: "BRL", periodDays: 30, trialDays: 7 },
    place: { amount: 4900, currency: "BRL", periodDays: 30, implies: ["spot", "guide"] },
    spot: { amount: 2900, currency: "BRL", periodDays: 30 },
  },
  providers: { pix: { data: ["payer"] } },
  contexts: ["claim", "renew"],
});
```

- `amount` is in the currency's smallest unit.
- `periodDays` is how long one paid period lasts.
- `implies` names the plans a plan includes while it is held.
- `trialDays` lets an account hold the plan that many days for free, once, if
  it never held the plan in any way.
- `providers` names the methods the project takes, and the fields of a
  charge's `data` each may keep.
- `contexts` names what a charge may be for.

Hand the same data to the server in the app's server setup, `src/server.js`,
which the generated `.light/server.ts` imports after the package contributions
and before the server is made:

```js
// src/server.js
import { registerBilling } from "@lightstart/billing/server";
import billing from "./billing.js";

registerBilling(billing);
```

The page configures its controller with the same data:

```js
import { billing } from "@lightstart/billing/page";
import config from "./billing.js";

billing.configure(config);
```

## The ledger

- An `entitlement` row is one paid period of one plan, under the id of what
  granted it: `charge:<id>`, `trial:<plan>:<account>`, or a provider's own id
  when it calls `grantUntil`.
- A person holds a plan while one of its active periods is on, and while a
  plan it implies is on.
- A new period starts where the last one ends, so paying early adds to the end.
- Dates are SQLite's `datetime()` form in UTC (`lib/ledger.ts` reads and writes
  them).
- `billingSession(db, userId)` answers `{ entitlements: { <plan>: <when it
  runs out> }, heldBefore: [<plan>, …] }`. A plan another plan implies runs out
  with it, and `heldBefore` names every plan ever held, which rules a trial
  out.
- A trial is a row like any other, under `trial:<plan>:<account>`.

## The rules

| | who | what happens |
|---|---|---|
| record a charge | server code | a plan the project sells, through a method it takes. The call stamps the id, owner, amount, currency, reference and `pending`; a newer pending charge for the same plan calls the older pending one off |
| pending to paid | admin | grants the plan for its period and stamps `paidAt`; confirming again grants nothing more |
| pending to canceled | admin | nothing is granted |
| paid to refunded | admin | the period it granted is revoked |
| start a trial | a signed-in person | their own plan with `trialDays` they never held: that many days from now, whatever the request asks; a second one is 409 |
| read | the owner | their own charges and periods |

`recordCharge`, `confirmCharge`, `refundCharge` and the other methods below are
the only way a payment method writes a charge. The models are
`$permissions: { read: "owner", create: "none", write: "none", delete: "none",
ownerField: "userId" }`, so the CRUD routes never let a client forge or change
one.

## The methods

Everything here is exported by `@lightstart/billing/server`.

| Method | What it does |
|---|---|
| `registerBilling(config)` | hands the server the project's plans, methods and contexts, once, from the app's `src/server.js` |
| `billingConfig()` | the registered config, or a failure saying none was registered |
| `registeredBilling()` | the registered config, or null |
| `recordCharge(db, input)` | writes one charge and returns its row; `input` is `{ userId, plan, provider, amount?, currency?, data?, context?, status? }` |
| `confirmCharge(db, id)` | moves a pending charge to paid, grants its plan for its period, and returns the row |
| `cancelCharge(db, id)` | moves a pending charge to canceled |
| `refundCharge(db, id)` | moves a paid charge to refunded and revokes the period it granted |
| `startTrial(db, userId, planId, now?)` | grants a plan's trial once and returns the entitlement row |
| `holds(db, userId, plan, now?)` | whether the account holds the plan at that moment, directly or through an implied plan |
| `activeKeys(db, userId, plans?)` | every key the account holds now, implied plans included |
| `hasKey(db, userId, key)` | whether `holds` names `key` |
| `billingSession(db, userId)` | `{ entitlements, heldBefore }` for a session |
| `forgetBilling(db, userId)` | deletes the account's periods and clears the owner on its charges |
| `grantPeriod(db, { userId, key, source, ref, days, plan? })` | grants `days` after whatever is held, under `${source}:${ref}` |
| `grantUntil(db, { userId, key, source, ref, expiresAt, plan? })` | grants until the store's own end, following a renewal and staying revoked once taken back |
| `revokeRef(db, { source, ref })` | takes back the period under `${source}:${ref}` |
| `listCharges(db, status?)` | the admin's charges, newest first |
| `listEntitlements(db)` | every period, newest end first |
| `BillingError` | a refusal carrying the HTTP `status` an endpoint answers |

`recordCharge` takes its amount and currency from the plan unless the caller
gives them, keeps only the `data` fields the method declares (trimmed to 120
characters), and sanitizes `context` against the project's `contexts`. A
payment method that records an already-confirmed payment passes
`status: "paid"`, which grants the period in the same call.

`@lightstart/play-billing` records a store subscription with `grantUntil` and
`revokeRef`, and can read what an account holds with `holds` and `activeKeys`.
`@lightstart/pix` records its payment with `recordCharge`, then confirms it
with `confirmCharge` when the money lands.

## The endpoints

The package's `light.server` contribution adds these beside the app's routes.

| Route | Who | What |
|---|---|---|
| `POST /api/billing/trial` | a signed-in person | starts `{ plan }`'s trial; answers the entitlement, 201 |
| `GET /api/billing/entitlements` | the account | `{ entitlements, heldBefore }`; an admin may pass `?userId=` |
| `GET /api/billing/charges?status=` | admin | `{ rows, entitlements }`, newest first |
| `POST /api/billing/charges/:id/confirm` | admin | confirms a pending charge |
| `PATCH /api/billing/charges/:id` | admin | `{ status: "paid" \| "canceled" \| "refunded" }` |

A refusal is `{ error }` with 400, 403, 404, 409 or 500; a non-admin's call to
an admin route is 403 before anything is read.

## The page controller

`billing` from `@lightstart/billing/page` follows the `auth` session:

- `configure(config)` takes the project's plans once.
- `plans()` answers them by id, and `method(id)` one provider's settings.
- `holds(plan)` reads the session's entitlements, or the ones `load()` read
  from `GET /api/billing/entitlements`; `holdsAny()` and `expiresOf(plan)` read
  the same state.
- `canTry(plan)` says whether the account may start the plan's trial here.
- `startTrial(plan)` posts the trial, then reloads the ledger and the session.
- `load()` reads the account's entitlements, and `message` holds a failure.

No method throws: a failure is `message`.

## The admin payments view

Declaring the package installs its extension (`light.extension`): the
admin-only `/admin/payments` (`localized: false`) draws the charges in their
tabs (To match, Paid, Canceled, Refunded), the selected charge's detail beside
the list, a Refresh action, and the moves its status allows (Mark paid,
Cancel, Refund). A waiting charge says what to look for on the statement; a
paid one says the period it granted. A signed-out reader sees a sign-in state,
and a signed-in non-admin a not-allowed state; the server refuses a non-admin's
calls regardless.

The controller is `payments` from the extension: `charges`, `entitlements`,
`loading`, `message` and `busy` are its state; `load()` reads the admin list,
`inStatus(status)` and `charge(id)` read it, and `move(id, status)` makes a
move. None of them throws: a failure is the controller's `message`.

## Files

| File | Runtime | Role |
|---|---|---|
| `index.ts` | every | `defineBilling`, the statuses, `mintChargeId`, `mintReference` |
| `types.ts` | every | the shared plan, method, charge, entitlement and input types |
| `lib/ledger.ts` | every | `sqlDate`, `msOf`, `nextPeriod`, `withImplied`, `heldUntil` |
| `server/config.ts` | server | `registerBilling`, `billingConfig`, `registeredBilling` |
| `server/models.ts` | server | the `charge` and `entitlement` tables |
| `server/api.ts` | server | the methods above over `D1Like` |
| `server/endpoints.ts` | server | the trial, entitlements and admin routes |
| `server/contribute.ts` | server | the contribution `light.server` names |
| `page/controller.ts` | browser | the `billing` controller |
| `payments/controller.ts` | browser | the admin's payments controller |
| `payments/lib.ts` | browser | money, dates, tabs and statement helpers |
| `payments/extension.ts` | browser | `/admin/payments` |
| `views/payments*.ts` | browser | the `payments-page` and `payments-detail` tags |
| `locales/{en,pt,es}.js` | browser | their words |
| `tags.json` | browser | the package's tag table |

## What changed from the source

- The plan data and rules are not a policy registry: the app registers the
  config once (`registerBilling`) and calls the methods directly.
- Client writes go through no model CRUD. The models are read-only to their
  owner, and a payment method writes with `recordCharge`.
- The source's device checkout, provider registry and `requestCharge` are left
  to the payment method's package; part 1 has no client checkout.
- The admin view is the package's `light.extension` at `/admin/payments`, not
  an IDE workbench unit, and it has no grant-by-hand form or moderation queue
  panel yet.
- `forWhat` is generic over the project's `contexts` instead of naming the
  source app's claim, renewal and listing kinds.

## Checks

- `light typecheck @lightstart/billing`
- `light test @lightstart/billing`
- `light test test/payments.browser.test.js` (from `packages/billing`)
- `light check --all`
