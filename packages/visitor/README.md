# @lightstart/visitor

Who a request came from, and how much of that an install keeps. The modules
run on Web APIs only, so the same copy runs in node, a Worker and a browser
tab.

| Module | Exports |
|---|---|
| `server/ip.ts` | `clientIp` |
| `server/hash.ts` | `hashHex`, `hashIp`, `periodFor`, `visitorId`, `VISITOR_WINDOWS` |
| `server/bot.ts` | `isBotUserAgent`, `isSuspiciousPath`, `detectBot` |
| `server/rate.ts` | `rateSalt`, `perAddress` |
| `server/models.ts` | `visitorModels`: the `visits` table |
| `server/contribute.ts` | `visitorContribution`, its default export |

`index.ts` re-exports the whole server surface; `@lightstart/visitor/server`
names it directly.

## The address

```js
import { clientIp } from "@lightstart/visitor/server";

const ip = clientIp(await c.request(), { trusted: true, ip: c.ip });
```

There is one precedence, and it is this function:

1. `CF-Connecting-IP` when `trusted` says the host is Cloudflare. Cloudflare
   overwrites that header at its edge, so a client cannot forge it there.
2. Otherwise the `ip` option, which the caller passes from
   `@lightstart/server`'s `c.ip`. `TrustProxy` is what corrects `c.ip` from the
   headers a trusted peer sent.
3. Otherwise `null`.

A raw `X-Forwarded-For` is never believed here. Reading the chain in each
policy is how six copies of this precedence drifted before, one of them keying
a rate limit on `"1.2.3.4, 5.6.7.8"` instead of the client. The check rule
`visitor/one-client-ip-precedence` fails a file outside this package that names
`CF-Connecting-IP` alongside `X-Forwarded-For`.

## The digest

```js
import { hashIp } from "@lightstart/visitor/server";

const ipHash = await hashIp(env.RATE_SALT || env.JWT_SECRET, ip);
```

SHA-256 of `` `${salt}:${ip}` ``, truncated to 16 bytes and rendered hex. The
salt is what stops the digest being a lookup table: an unsalted SHA-256 of an
IPv4 address has 2^32 preimages. It is also what makes the same person on two
installs two unrelated ids.

`hashHex(input, bytes)` is the primitive under it, for a domain other than an
address.

## The visitor

```js
import { visitorId } from "@lightstart/visitor/server";

await visitorId(salt, { window: "daily", ip, userAgent, at: entry.ts * 1000 });
```

| `window` | Two requests are one visitor when | Touches the device |
|---|---|---|
| `off` | never; the answer is `null` | no |
| `daily` | same address, same user agent, same UTC day | no |
| `monthly` | same, over a UTC month | no |
| `persistent` | same, with no window term at all | no |
| `client` | the device sent the same `clientId` | yes |

`at` is the moment being recorded, never `Date.now()`. That is what makes
replaying a week-old archive reproduce the ids it produced the first time.

`client` is the only value that writes to or reads from a visitor's device, and
the only one carrying a consent obligation. A `clientId` is hashed like
everything else, so the column holds no value a reader could have taken from a
browser. Without one, `client` falls back to the `daily` derivation.

## Bots

```js
import { detectBot } from "@lightstart/visitor/server";

detectBot(userAgent, path); // { isBot, reason: "user_agent" | "path" | "both" | null }
```

A user agent is self-reported and a path only says what was probed, so `reason`
carries which signal fired and a caller can weigh them.

## The per-address rate

```js
import { perAddress } from "@lightstart/visitor/server";

const { ipHash, limited } = await perAddress(db, "visits", {
  env, ip, max: 5, seconds: 600,
});
```

It counts the rows `ipHash` wrote to the table in the window and answers the
digest a row should carry. The counts are in the database, never in an isolate's
memory: isolates share nothing on Cloudflare. Counting the contributed `visits`
table records a visit when the cap is not reached, so it fills itself. Counting
a table of the policy's own rows (`live`, `rsvp`, each with an `ipHash` column)
only reads it; `record: true` or `false` overrides either default.

The table and column are identifiers and are checked before they reach the
statement. The table is named at the call (`"visits"` for the contributed one);
the column defaults to `ipHash`.

## The server contribution

The package declares `"light": { "server": "./server/contribute.ts" }`, and
that file answers `{ models: visitorModels }` with only `models`. A migration
therefore creates the `visits` table, and nothing else from the package joins
the app's server:

```js
{
  id: { $type: "string", required: true },
  ipHash: { $type: "string", required: true, index: true },
  $permissions: { read: "none", create: "none", write: "none", delete: "none" },
}
```

`created` is the timestamp column every generated table has; the rate window
compares against it. `$permissions: none` keeps the table out of the CRUD
routes, so only the policy reads or writes it.
