/**
 * @file @lightstart/visitor: who a request came from: the client's address on
 * each host, a salted pseudonym for it, a configurable visitor identity, bot
 * detection, and per-address limits kept in the database.
 *
 * `server/ip.ts` answers the address once, `server/hash.ts` the pseudonym and
 * the visitor id, `server/bot.ts` whether the thing asking is a person, and
 * `server/rate.ts` the per-address cap over the contributed `visits` table.
 */

export * from "./server/index.ts";
