# Working on @lightstart/pix

What the package is and how to use it: [README.md](README.md). This file is
what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `brcode`, `crc16`, `pixText` and the types |
| `types.ts` | `PixCode`, `PixSettings`, `PixCharge` |
| `lib/brcode.ts` | The EMV BR Code and its CRC16-CCITT |
| `server/charge.ts` | `POST /api/pix/charge` |
| `server/contribute.ts` | The contribution `light.server` names |
| `server/index.ts` | The server surface |
| `views/checkout.ts` | `<pix-checkout>` |
| `locales/{en,pt,es}.js` | The words the view draws, under `pix-checkout` |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `test/` | `brcode.test.ts`, `charge.test.ts` (node-only) and `checkout.browser.test.js` (Chromium) |

## Rules the sources keep

- `lib/brcode.ts` is pure: no DOM, no server, no app. Its CRC16 and field
  folding stay exactly as the Banco Central's manual reads them.
- The Pix account is the server's environment (`PIX_KEY`,
  `PIX_MERCHANT_NAME`, `PIX_MERCHANT_CITY`). The page never holds it and never
  builds a code alone; the endpoint answers the code with the charge.
- A charge is written only through billing's `recordCharge`, with
  `provider: "pix"`. The endpoint sets the owner from the caller and keeps
  only the `payer` field the project's method declares.
- The endpoint is `access: "auth"`. It refuses a missing Pix account with 500
  rather than answering a code that pays nobody.
- The view follows the `auth` controller and draws the `lc-*` tags and
  `<qr-code>`; it imports no model and no server file.
- TypeScript with erasable syntax; no `any`, in TS or JSDoc. Comments are a
  JSDoc module header and JSDoc on exports.
- Tests are plain scripts on `@lightstart/test/assert.ts`; a browser test runs
  one file at a time.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `brcode`, `crc16`, `pixText` and `PixCode` | an app building its own code |
| `POST /api/pix/charge` and its `{ charge, code }` answer | the checkout, and an app with its own checkout |
| `<pix-checkout>`, its props and `done` | an app's billing page |
| `light.server`, `light.tags` and `light.locales` | the web generation, the server and the deploy |
| The `pix-checkout` locales | a page running `@lightstart/i18n` |

## Gates

From the repository root:

```bash
light typecheck @lightstart/pix
light test @lightstart/pix
light check --all
```

From `packages/pix`, one browser file per run:

```bash
light test test/checkout.browser.test.js
```
