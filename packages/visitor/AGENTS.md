# Working on @lightstart/visitor

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public surface: everything from `server/` |
| `server/types.ts` | `IpRequest`, `ClientIpOptions`, `VisitorWindow`, `Visit`, `BotVerdict` |
| `server/ip.ts` | `clientIp`: the one client-IP precedence |
| `server/hash.ts` | `hashHex`, `hashIp`, `periodFor`, `visitorId`, `VISITOR_WINDOWS` |
| `server/bot.ts` | `isBotUserAgent`, `isSuspiciousPath`, `detectBot` |
| `server/rate.ts` | `rateSalt`, `perAddress` |
| `server/models.ts` | `visitorModels`: `visits`, `$permissions: none` |
| `server/contribute.ts` | The package's server contribution: `models` only |
| `check/rules/one-client-ip-precedence.js` | The rule that keeps the address precedence in one file |
| `test/` | `ip.test.ts`, `hash.test.ts`, `bot.test.ts`, `rate.test.ts` |

## Rules the sources keep

- `server/` uses Web APIs (`crypto.subtle`, `TextEncoder`) and reaches the database only through `D1Like`. It never imports a node module, because it runs in Workers.
- `clientIp` is the only place that reads `CF-Connecting-IP`. It reads it only when `trusted` names the host as Cloudflare, and it never reads `X-Forwarded-For`. The caller passes `c.ip` for every other host, so `TrustProxy` stays the one thing that corrects a proxy chain.
- The visitor id's `at` is the moment being recorded, never `Date.now()`, so a replayed archive reproduces its ids.
- `visits` stays `$permissions: none`; only `perAddress` reads or writes it. Its `created` column is the window's clock, and the schema does not redeclare it.
- `perAddress` reads before it writes, and only records when the cap is not reached. It records by default into the contributed `visits` table, and only reads a table of the policy's own rows; `record` overrides both. Table and column are identifiers and are checked before interpolation; they are never taken from a request.
- TypeScript with erasable syntax; no `any`. Comments are a JSDoc module header and JSDoc on exports.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `clientIp`, its `{ trusted, ip }` options, and the precedence | an app's server and its policies |
| `hashIp`, `hashHex`, `visitorId`, `VISITOR_WINDOWS` | analytics, ingest and a policy that stores a pseudonym |
| `detectBot` and its `reason` | a policy that weighs the two signals |
| `perAddress`, `rateSalt`, and the `visits` table | an app's write policies and its migrations |
| `"light": { "server": "./server/contribute.ts" }` and `{ models }` | the generation that merges a package's server models |
| The `visitor/one-client-ip-precedence` rule | `light check` in an app that depends on this package |

## Gates

From the repository root:

```bash
light typecheck @lightstart/visitor
light test @lightstart/visitor
```
