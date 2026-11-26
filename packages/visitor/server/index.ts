/**
 * @file `@lightstart/visitor/server`: the request-time half, the client's
 * address, its salted pseudonym, bot detection, the per-address limit, and the
 * `visits` table the limit counts.
 */

export { clientIp } from "./ip.ts";
export { hashHex, hashIp, periodFor, visitorId, VISITOR_WINDOWS } from "./hash.ts";
export { detectBot, isBotUserAgent, isSuspiciousPath } from "./bot.ts";
export { perAddress, rateSalt, type PerAddressOptions, type PerAddressVerdict, type RateEnv } from "./rate.ts";
export { visitorModels } from "./models.ts";
export type { BotVerdict, ClientIpOptions, IpRequest, Visit, VisitorWindow } from "./types.ts";
