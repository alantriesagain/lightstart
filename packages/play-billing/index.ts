/**
 * @file @lightstart/play-billing: paying through Google Play. Purchases are
 * verified on the server with the Play Developer API, granted through
 * `@lightstart/billing`, and followed through Play's real-time developer
 * notifications; `<play-checkout>` drives the Android shell's Play Billing
 * add-on. The product ids are the project's plan ids.
 */

export { PLAY_BUY, PLAY_PRODUCTS } from "./commands.ts";
export type { PlayCheckoutProps, PlayEnv, PlayGrant, PlayProduct, PlaySubscription } from "./types.ts";
