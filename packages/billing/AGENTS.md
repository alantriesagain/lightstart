# Working on @lightstart/billing

What the package is and how to use it: [README.md](README.md). This file is
what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `defineBilling`, `CHARGE_STATUSES`, `ENTITLEMENT_STATUSES`, `mintChargeId`, `mintReference` |
| `types.ts` | `BillingConfig`, `BillingPlan`, `BillingMethod`, `BillingContext`, `ChargeRow`, `EntitlementRow`, `RecordChargeInput` |
| `lib/ledger.ts` | `sqlDate`, `msOf`, `nextPeriod`, `withImplied`, `heldUntil` |
| `server/config.ts` | `registerBilling`, `billingConfig`, `registeredBilling` |
| `server/models.ts` | `billingModels`: `charge` and `entitlement`, owner-readable and client-write-free |
| `server/api.ts` | `recordCharge`, `confirmCharge`, `cancelCharge`, `refundCharge`, `startTrial`, `holds`, the ledger grants and reads, the admin lists |
| `server/endpoints.ts` | `/api/billing/trial`, `/api/billing/entitlements`, the admin charges list and moves |
| `server/contribute.ts` | The contribution `light.server` names |
| `server/index.ts` | The server surface |
| `page/controller.ts` | The `billing` controller: session follows, holds, plans, trial |
| `page/index.ts` | The page surface |
| `payments/controller.ts` | The admin's `payments` controller |
| `payments/lib.ts` | Tabs, money, dates, `forWhat`, `periodOf`, `statementOf` |
| `payments/extension.ts` | The extension: `/admin/payments` |
| `views/payments*.ts` | The two `payments-*` tags |
| `locales/{en,pt,es}.js` | The words those tags draw |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `test/` | `contribute.test.ts` (a project declaring api, auth and billing), `controller.test.ts` (the page controller over a fake fetch), `payments.browser.test.js` (the admin page in Chromium) |

## Rules the sources keep

- `server/` uses Web APIs and `D1Like` only: no node module and no Cloudflare
  type. The page imports only `lib/ledger.ts`, never a `server/` file.
- The config is plain data. `defineBilling` returns it; the page and the
  server read the same object from an app's `src/billing.js`. The server gets
  it through `registerBilling`, called by the app's `src/server.js` before
  `createServer` runs, because a contribution cannot import the app's file.
- The models stay `$permissions: { read: "owner", create: "none", write:
  "none", delete: "none", ownerField: "userId" }`. A client never writes a
  charge or a period through CRUD; the methods and endpoints write them.
- The methods stamp the id, owner, amount, currency, reference and status
  themselves. `recordCharge` keeps only the `data` fields the method declares
  and sanitizes `context` against the project's `contexts`.
- Only a signed-in account starts its own trial, only once, only for a plan
  with `trialDays`, and never after it held the plan. A trial is
  `trial:<plan>:<account>`.
- A period starts where the last one ended. `grantPeriod` is idempotent by
  `${source}:${ref}`; `grantUntil` follows a store's renewal and a revoked row
  stays revoked.
- `holds` and `billingSession` add what a plan `implies`. `heldBefore` is every
  key ever held, which rules a trial out.
- A non-admin never lists or moves a charge: the endpoints are `access:
  "admin"`, and the page's gate is cosmetic.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module
  header and JSDoc on exports. Tests are plain scripts on
  `@lightstart/test/assert.ts`; browser tests run one file at a time.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `defineBilling`, the plan/method/context shapes | an app's `src/billing.js` |
| `registerBilling`, `billingConfig` | an app's `src/server.js` |
| `recordCharge`, `confirmCharge`, `refundCharge` | `@lightstart/pix` and another payment method |
| `grantUntil`, `revokeRef`, `holds`, `activeKeys` | `@lightstart/play-billing` and an account hook |
| `billingSession`, `forgetBilling` | auth's `sessionFields` and `onUserDeleted`, when an app builds its own |
| `ChargeRow`, `EntitlementRow` and the `charge:`/`trial:` id shapes | a payment method, the admin view and a page |
| `POST /api/billing/trial`, `GET /api/billing/entitlements`, the admin routes | the page controller and the admin view |
| The `billing` controller, its `configure`, `holds`, `plans` and `startTrial` | an app's views |
| The `payments` controller and the `light.extension` route `/admin/payments` | an app that installs the payments view |
| `light.server` in `package.json` and the contributed models | `light db:migrate`, `light serve`, the deploy |

## Gates

From the repository root:

```bash
light typecheck @lightstart/billing
light test @lightstart/billing
light check --all
```

From `packages/billing`, one browser file per run:

```bash
light test test/payments.browser.test.js
```
