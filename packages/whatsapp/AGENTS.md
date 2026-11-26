# Working on @lightstart/whatsapp

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | `waMeHref`, `normalizeGroupInvite`, `isGroupPhoto`, `readInvite`: what a page uses |
| `client.ts` | The `wa.me` link and group invite helpers |
| `invite.ts` | `readInvite`: an invite page read as a link preview |
| `server/models.ts` | `whatsappModels`: `whatsapp_account` (owner reads), `whatsapp_code` and `whatsapp_message` (`none`) |
| `server/core.ts` | `issueCode`, `issueLogin`, `codeStatus`, `receive`, `redeemLogin`, `whatsappLogin`, `whatsappSession`, `forgetWhatsapp`, `senderKey` |
| `server/parse.ts` | `eventsOf`: what a Meta delivery means, and what it drops |
| `server/signature.ts` | `verifyChallenge`, `verifySignature`, `signatureOf`, `constantTimeEqual` |
| `server/hooks.ts` | `registerWhatsappHook`, `confirmedHooks`, `clearWhatsappHooks` |
| `server/contribute.ts` | The server contribution `light.server` names: tables, endpoints, and the `registerIdentity` call |
| `server/types.ts` | The shapes the package hands around |
| `page/controller.ts` | The `whatsapp` controller: connect, refresh, and `signIn` by polling the identity |
| `test/` | `signature.test.ts`, `parse.test.ts`, `client.test.ts`, and `contribute.test.ts` (a temp project declaring the package end to end) |

## Rules the sources keep

- `server/` uses Web APIs and `D1Like` only, never a node module. The webhook's HMAC is Web Crypto.
- A nonce is never stored or answered after issuance; the row keeps only `SHA-256(nonce)`. A login code is redeemed by a conditional write on `redeemedAt`, so a second redeem is refused.
- A code is six digits, good for ten minutes, ended by the next one, five an hour per account and ten an hour per address. No value issued in the last day is drawn again.
- `whatsapp_code` and `whatsapp_message` stay `$permissions: none`; `whatsapp_account` is `read: "owner"` on `ownerField: "userId"` and nobody may write it through the model router.
- Only a business-scoped id signs in; a sender named by `+<number>` alone is refused with 422.
- The identity is registered by importing `server/contribute.ts`, with `registerIdentity({ name: "whatsapp", redeem })`. Registration is a side effect of that import.
- Hooks are a registry (`registerWhatsappHook`), mirroring `registerIdentity`; a throwing hook is skipped, and a repeated delivery confirms nothing.
- The page controller never throws to its caller; a network failure is `{ error, status: 0 }`.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports.
- Tests are plain scripts on `@lightstart/test/assert.ts`; no network goes to Meta, and a reply uses an injectable `fetch` in `receive`.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| The `/api/whatsapp-*` routes and their bodies | the page controller, and apps calling them |
| `whatsappModels`, `whatsappEndpoints`, the default server contribution | an app's server, and `light db:migrate` |
| `registerIdentity("whatsapp", ...)`, and the `pending` / `error` / `userId` + `link` answer shape | `@lightstart/auth`'s `/api/auth/identity/:name` and the page's `signInWithIdentity` |
| `registerWhatsappHook` and the confirmed shape | an app acting on a code |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_NUMBER`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_ASK_TEXT` | the deploy's secrets |
| The `whatsapp` controller's props and methods | an app's views |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/whatsapp
light test @lightstart/whatsapp
```
