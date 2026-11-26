// node-only
/**
 * @file The per-address rate over a D1-shaped database: the salt, the count in
 * the window, the digest the row carries, and the optional visit it records.
 */

import type { D1Like, D1StatementLike } from "@lightstart/api/server";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { hashIp } from "../server/hash.ts";
import { perAddress, rateSalt } from "../server/rate.ts";

type Seen = { sql: string; args: unknown[] };

const dbWith = (n: number) => {
  const seen: Seen[] = [];
  const db: D1Like = {
    prepare(sql: string): D1StatementLike {
      const statement: D1StatementLike = {
        bind(...args: unknown[]): D1StatementLike {
          seen.push({ sql, args });
          return statement;
        },
        async all() {
          return { results: [] };
        },
        async first() {
          return sql.startsWith("SELECT") ? { n } : null;
        },
        async run() {
          return { success: true };
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
  return { db, seen };
};

const main = async (): Promise<void> => {
  eq("rateSalt: the install's own", rateSalt({ RATE_SALT: "s", JWT_SECRET: "j" }), "s");
  eq("rateSalt: else the signing secret", rateSalt({ JWT_SECRET: "j" }), "j");
  eq("rateSalt: else nothing", rateSalt({}), "");

  const db = dbWith(3);
  const got = await perAddress(db.db, "live", { env: { RATE_SALT: "s" }, ip: "1.2.3.4", max: 10 });
  eq("perAddress: under the cap", String(got.limited), "false");
  eq("perAddress: the digest the row carries", got.ipHash, await hashIp("s", "1.2.3.4"));
  eqn("perAddress: one count statement", db.seen.length, 1);
  ok("perAddress: counts by digest inside the window", /FROM live WHERE ipHash = \? AND created > datetime\('now', \?\)/.test(db.seen[0]?.sql ?? ""));
  eq("perAddress: the window is the second argument", JSON.stringify(db.seen[0]?.args), JSON.stringify([got.ipHash, "-60 seconds"]));

  const visits = dbWith(3);
  const counted = await perAddress(visits.db, "visits", { env: {}, ip: null, max: 10 });
  eq("perAddress: the contributed table records by default", String(counted.limited), "false");
  eqn("perAddress: its count and its visit", visits.seen.length, 2);

  const capped = dbWith(10);
  const reached = await perAddress(capped.db, "visits", { env: {}, ip: null, max: 10, seconds: 300 });
  eq("perAddress: reached at the cap", String(reached.limited), "true");
  eqn("perAddress: and a limited address records no visit", capped.seen.length, 1);

  const recorded = dbWith(3);
  const allowed = await perAddress(recorded.db, "visits", { env: {}, ip: null, max: 10, record: true });
  eqn("perAddress: an allowed address records its visit", recorded.seen.length, 2);
  ok("perAddress: into the contributed table", /INSERT INTO visits \(id, ipHash\) VALUES \(\?, \?\)/.test(recorded.seen[1]?.sql ?? ""));
  ok("perAddress: with a generated id and the digest", /^[0-9a-f-]{36}$/.test(String(recorded.seen[1]?.args[0])) && recorded.seen[1]?.args[1] === allowed.ipHash);

  let refused = false;
  try {
    await perAddress(dbWith(0).db, "visits; DROP TABLE visits", { env: {}, ip: null, max: 1 });
  } catch (e) {
    refused = e instanceof Error && e.message.includes("must be identifiers");
  }
  ok("perAddress: a table name that is not an identifier is refused", refused);

  done();
};

await main();
